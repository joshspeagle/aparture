// Validates a request password against ACCESS_PASSWORD.
//
// Fails closed: when ACCESS_PASSWORD is unset or empty, NO password is
// accepted. Without this guard, a route comparing `password !==
// process.env.ACCESS_PASSWORD` on a misconfigured deployment authorizes
// credential-less requests (`undefined !== undefined` is false).
export function checkAccessPassword(password) {
  const configured = process.env.ACCESS_PASSWORD;
  return Boolean(configured) && password === configured;
}
