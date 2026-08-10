module.exports = (request, options) => {
  const isDialerSourceImport =
    options.basedir.includes('/packages/dialer/src') &&
    (request.startsWith('./') || request.startsWith('../')) &&
    request.endsWith('.js');

  return options.defaultResolver(
    isDialerSourceImport ? request.slice(0, -3) : request,
    options,
  );
};
