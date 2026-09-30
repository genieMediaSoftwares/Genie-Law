// Minimal step timer for measuring real flows on a device. Each finished trace
// logs one line; on Android (debug or release) it appears in Logcat under the
// ReactNativeJS tag:
//   [perf] profile-photo: picked 812ms → compressed 431ms → uploaded 2204ms | total 3447ms (ok)
// Read it with:  adb logcat -s ReactNativeJS | findstr "[perf]"
export interface PerfTrace {
  mark: (step: string) => void;
  end: (outcome?: string) => void;
}

export function startTrace(name: string): PerfTrace {
  const startedAt = Date.now();
  let last = startedAt;
  const steps: string[] = [];
  let ended = false;

  return {
    mark(step) {
      const now = Date.now();
      steps.push(`${step} ${now - last}ms`);
      last = now;
    },
    end(outcome = 'ok') {
      if (ended) {
        return;
      }
      ended = true;
      console.log(
        `[perf] ${name}: ${steps.join(' → ') || '-'} | total ${Date.now() - startedAt}ms (${outcome})`,
      );
    },
  };
}
