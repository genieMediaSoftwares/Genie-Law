const isFormField = (element: Element): boolean => {
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (element as HTMLElement).isContentEditable
  );
};

export const blurActiveElement = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const active = document.activeElement;

  if (
    active instanceof HTMLElement &&
    active !== document.body &&
    !isFormField(active)
  ) {
    active.blur();
  }
};

let installed = false;

export const installWebFocusHygiene = (): (() => void) => {
  if (typeof document === 'undefined' || installed) {
    return () => undefined;
  }

  installed = true;

  const onClickCapture = (event: MouseEvent): void => {
    if (event.detail === 0) {
      return;
    }
    blurActiveElement();
  };

  document.addEventListener('click', onClickCapture, true);

  return () => {
    document.removeEventListener('click', onClickCapture, true);
    installed = false;
  };
};
