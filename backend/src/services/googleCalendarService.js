const { google } = require("googleapis");
const Lawyer = require("../models/Lawyer");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { keepAlive } = require("../utils/background");
const { required, optional } = require("../config/env");

class GoogleCalendarService {
  isRealMode() {
    return Boolean(optional("GOOGLE_CLIENT_ID") && optional("GOOGLE_CLIENT_SECRET"));
  }

  async getOAuthClient(lawyer) {
    if (!this.isRealMode()) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      required("GOOGLE_CLIENT_ID"),
      required("GOOGLE_CLIENT_SECRET"),
      required("GOOGLE_REDIRECT_URI")
    );

    oauth2Client.setCredentials({
      access_token: lawyer.googleAccessToken,
      refresh_token: lawyer.googleRefreshToken,
      expiry_date: lawyer.googleTokenExpiry ? new Date(lawyer.googleTokenExpiry).getTime() : null,
    });

    const isExpired = lawyer.googleTokenExpiry && new Date(lawyer.googleTokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;
    if (isExpired && lawyer.googleRefreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        lawyer.googleAccessToken = credentials.access_token;
        if (credentials.expiry_date) {
          lawyer.googleTokenExpiry = new Date(credentials.expiry_date);
        }
        await lawyer.save();
        
        oauth2Client.setCredentials(credentials);
      } catch (err) {
        console.error("Failed to refresh Google OAuth access token for lawyer:", lawyer.user, err.message);
      }
    }

    return oauth2Client;
  }

  parseDateTime(dateObj, timeSlot) {
    const startDate = new Date(dateObj);
    const timePart = timeSlot.split("-")[0].trim();
    const match = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
    
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      startDate.setHours(hours, minutes, 0, 0);
    } else {
      startDate.setHours(9, 0, 0, 0);
    }
    
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    return { startDate, endDate };
  }

  async createOrUpdateEvent(appointmentId) {
    try {
      const appointment = await Appointment.findById(appointmentId)
        .populate("client", "fullName email")
        .populate("case", "title category");
        
      if (!appointment) return;

      const lawyer = await Lawyer.findOne({ user: appointment.lawyer });
      if (!lawyer || !lawyer.googleConnected) {
        return;
      }

      const clientName = appointment.client ? appointment.client.fullName : "Unknown Client";
      const { startDate, endDate } = this.parseDateTime(appointment.date, appointment.timeSlot);
      const isChatMode = appointment.mode === "Chat";
      const meetingNotes = appointment.notes || `Genie Law Consultation\nClient: ${clientName}\nMode: ${appointment.mode}\nDate: ${appointment.timeSlot}`;

      if (!this.isRealMode() || lawyer.googleRefreshToken === "mock_refresh_token") {
        console.log(`[SIMULATED GOOGLE CALENDAR] Syncing event for Appointment: ${appointmentId}`);
        console.log(`- Summary: Genie Law Consultation: ${clientName}`);
        console.log(`- Mode: ${appointment.mode}`);
        console.log(`- Time: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        console.log(`- Notes: ${meetingNotes}`);
        
        const meetingLink = appointment.meetingLink;
        
        const mockEventId = appointment.googleCalendarEventId || `mock_event_${Date.now()}`;
        
        await Appointment.findByIdAndUpdate(appointmentId, {
          googleCalendarEventId: mockEventId,
          meetingLink: meetingLink,
          notes: meetingNotes
        });
        
        console.log(`[SIMULATED GOOGLE CALENDAR] Sync Success. Saved Event ID: ${mockEventId}, Meet Link: ${meetingLink}`);
        return;
      }

      const authClient = await this.getOAuthClient(lawyer);
      if (!authClient) return;

      const calendar = google.calendar({ version: "v3", auth: authClient });
      
      const eventPayload = {
        summary: `Genie Law Consultation: ${clientName}`,
        description: meetingNotes,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: "Asia/Kolkata",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 10 },
          ],
        },
      };

      if (isChatMode && !appointment.meetingLink) {
        eventPayload.conferenceData = {
          createRequest: {
            requestId: `meet-${appointmentId}-${Date.now()}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        };
      }

      let response;
      if (appointment.googleCalendarEventId) {
        try {
          response = await calendar.events.patch({
            calendarId: "primary",
            eventId: appointment.googleCalendarEventId,
            requestBody: eventPayload,
            conferenceDataVersion: isChatMode ? 1 : 0,
          });
          console.log(`[REAL GOOGLE CALENDAR] Updated Event: ${response.data.id}`);
        } catch (patchErr) {
          if (patchErr.code === 410 || patchErr.code === 404) {
            appointment.googleCalendarEventId = "";
          } else {
            throw patchErr;
          }
        }
      }

      if (!appointment.googleCalendarEventId) {
        response = await calendar.events.insert({
          calendarId: "primary",
          requestBody: eventPayload,
          conferenceDataVersion: isChatMode ? 1 : 0,
        });
        console.log(`[REAL GOOGLE CALENDAR] Created Event: ${response.data.id}`);
      }

      if (response && response.data) {
        const updates = {
          googleCalendarEventId: response.data.id,
          notes: meetingNotes
        };
        
        if (response.data.hangoutLink) {
          updates.meetingLink = response.data.hangoutLink;
        }
        
        await Appointment.findByIdAndUpdate(appointmentId, updates);
      }
    } catch (err) {
      console.error("Google Calendar Sync Error in createOrUpdateEvent:", err);
    }
  }

  async deleteEvent(appointmentId) {
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment || !appointment.googleCalendarEventId) return;

      const lawyer = await Lawyer.findOne({ user: appointment.lawyer });
      if (!lawyer || !lawyer.googleConnected) return;

      if (!this.isRealMode() || lawyer.googleRefreshToken === "mock_refresh_token") {
        console.log(`[SIMULATED GOOGLE CALENDAR] Deleting event: ${appointment.googleCalendarEventId}`);
        await Appointment.findByIdAndUpdate(appointmentId, {
          googleCalendarEventId: "",
          meetingLink: ""
        });
        console.log(`[SIMULATED GOOGLE CALENDAR] Delete Success.`);
        return;
      }

      const authClient = await this.getOAuthClient(lawyer);
      if (!authClient) return;

      const calendar = google.calendar({ version: "v3", auth: authClient });
      
      try {
        await calendar.events.delete({
          calendarId: "primary",
          eventId: appointment.googleCalendarEventId,
        });
        console.log(`[REAL GOOGLE CALENDAR] Deleted Event: ${appointment.googleCalendarEventId}`);
      } catch (delErr) {
        if (delErr.code !== 404 && delErr.code !== 410) {
          throw delErr;
        }
      }

      await Appointment.findByIdAndUpdate(appointmentId, {
        googleCalendarEventId: "",
        meetingLink: ""
      });
    } catch (err) {
      console.error("Google Calendar Sync Error in deleteEvent:", err);
    }
  }

  async syncExistingAppointments(lawyerUserId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const appointments = await Appointment.find({
        lawyer: lawyerUserId,
        status: { $in: ["confirmed", "pending"] },
        date: { $gte: today },
      });

      console.log(`[GOOGLE CALENDAR] Found ${appointments.length} existing appointments to sync for lawyer: ${lawyerUserId}`);

      for (const appt of appointments) {
        await this.createOrUpdateEvent(appt._id);
      }
    } catch (err) {
      console.error("Google Calendar Sync Error in syncExistingAppointments:", err);
    }
  }
}

const service = new GoogleCalendarService();

// Controllers start these without awaiting them; track them so a graceful
// shutdown waits for them.
for (const name of ["createOrUpdateEvent", "deleteEvent", "syncExistingAppointments"]) {
  const run = service[name].bind(service);
  service[name] = (...args) => keepAlive(run(...args));
}

module.exports = service;
