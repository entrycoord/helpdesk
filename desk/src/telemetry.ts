interface CaptureOptions {
  data: {
    [key: string]: string | number | boolean | object;
  };
}

/**
 * Product telemetry is switched off in this fork: the framework's pulse
 * client (a script loaded from the Frappe vendor's servers) is no longer
 * installed, so nothing is loaded or sent. The call sites stay, they do
 * nothing.
 */
export function capture(
  _event: string,
  _options: CaptureOptions = { data: {} }
) {
  // intentionally empty
}
