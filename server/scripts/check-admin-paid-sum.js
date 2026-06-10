const BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';

async function main() {
  const login = await fetch(BASE + '/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await login.json();
  const list = await fetch(BASE + '/admin/bookings?page=1&pageSize=10', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const data = await list.json();
  console.log('amountSum:', data.amountSum);
  console.log('paidAmountSum:', data.paidAmountSum);
  console.log('unpaidAmountSum:', data.unpaidAmountSum);
  console.log('total:', data.total);
}

main().catch(console.error);
