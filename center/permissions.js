function roleFor(device, userId) {
  return device.owner === userId ? 'owner' : device.grants?.find((grant) => grant.userId === userId)?.role || null;
}
function canRequest(role, endpoint, method) {
  if (!role) return false;
  if (role === 'owner' || role === 'terminal') return true;
  if (!/^\/apps\/[a-z][a-z0-9-]{0,31}\//.test(endpoint)) return false;
  if (/^\/apps\/[a-z][a-z0-9-]{0,31}\/api\/logout$/.test(endpoint) && method === 'POST') return true;
  return role === 'operator' || (role === 'viewer' && ['GET', 'HEAD'].includes(method));
}
module.exports = { roleFor, canRequest };
