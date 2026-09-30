import React from 'react';
import { Platform } from 'react-native';

// Groups credential fields into a real <form> on the web, so browsers and
// password managers see a proper login/signup/change-password form. On iOS and
// Android it renders nothing extra.
//
// The <form> uses `display: contents`, so it adds no box of its own and the
// layout is exactly as before. Submitting it (Enter, when the browser treats it
// as submitted) calls `onSubmit` instead of reloading the page.

export interface GenieFormProps {
  onSubmit: () => void;
  // Account identifier for forms that only contain password fields (change
  // password, confirm deletion): a hidden username field lets password
  // managers match the saved credential.
  username?: string;
  children: React.ReactNode;
}

export const GenieForm: React.FC<GenieFormProps> = ({ onSubmit, username, children }) => {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return React.createElement(
    'form',
    {
      onSubmit: (event: { preventDefault: () => void }) => {
        event.preventDefault();
        onSubmit();
      },
      noValidate: true,
      style: { display: 'contents' },
    },
    username !== undefined
      ? React.createElement('input', {
          type: 'text',
          name: 'username',
          autoComplete: 'username',
          value: username,
          readOnly: true,
          hidden: true,
          'aria-hidden': true,
          tabIndex: -1,
        })
      : null,
    children,
  );
};
