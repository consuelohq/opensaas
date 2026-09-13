const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
const response = (body: string) =>
  '<?xml version="1.0" encoding="UTF-8"?><Response>' + body + '</Response>';
export const hangupTwiml = (message = '') =>
  response(
    (message ? '<Say>' + escapeXml(message) + '</Say>' : '') + '<Hangup/>',
  );
export const waitingTwiml = (
  url: string,
  voicemail: boolean,
  fallback = false,
) =>
  response(
    '<Gather numDigits="1" timeout="5" action="' +
      escapeXml(url) +
      '" method="POST"><Say>' +
      (fallback ? 'No representative is available. ' : 'Please hold. ') +
      'Press 1 to request a callback.' +
      (voicemail ? ' Press 2 to leave a voicemail.' : '') +
      '</Say><Pause length="2"/></Gather><Redirect method="POST">' +
      escapeXml(url) +
      '</Redirect>',
  );
export const screeningTwiml = (url: string, kind: 'phone' | 'browser') =>
  response(
    kind === 'phone'
      ? '<Gather numDigits="1" timeout="5" action="' +
          escapeXml(url) +
          '" method="POST"><Say>Consuelo incoming call. Press 1 to accept.</Say></Gather><Hangup/>'
      : '<Say>Accept the incoming offer in your dialer.</Say><Pause length="3"/><Redirect method="POST">' +
          escapeXml(url) +
          '</Redirect>',
  );
export const conferenceTwiml = (
  name: string,
  callback: string,
  role: 'caller' | 'rep',
) =>
  response(
    '<Dial><Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" participantLabel="' +
      role +
      '" statusCallback="' +
      escapeXml(callback) +
      '" statusCallbackMethod="POST" statusCallbackEvent="start end join leave">' +
      escapeXml(name) +
      '</Conference></Dial>',
  );
export const voicemailTwiml = (
  url: string,
  disclosure: string,
  maxSeconds: number,
) =>
  response(
    '<Say>' +
      escapeXml(disclosure) +
      '</Say><Record maxLength="' +
      maxSeconds +
      '" timeout="5" playBeep="true" transcribe="false" action="' +
      escapeXml(url) +
      '" recordingStatusCallback="' +
      escapeXml(url) +
      '" recordingStatusCallbackEvent="completed absent" method="POST"/><Hangup/>',
  );
