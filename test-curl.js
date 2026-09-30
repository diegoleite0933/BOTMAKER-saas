const cp = require('child_process');
const fs = require('fs');

function randomCpf() {
  const r = () => Math.floor(Math.random() * 9);
  const n = Array(9).fill(0).map(r);
  let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  let d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  return n.join('');
}

const cpf = randomCpf();

const payload = {
  identifier: "test_123",
  amount: 10,
  client: {
    name: "Test",
    email: "test@test.com",
    phone: "11999999999",
    document: cpf
  },
  products: [{id:"p1", name:"p", quantity:1, price:10}],
  callbackUrl: "https://clever-suns-pay.loca.lt"
};

fs.writeFileSync("test.json", JSON.stringify(payload));

try {
  const cmd = `curl.exe -s -X POST https://app.amplopay.com/api/v1/gateway/pix/receive -H "Content-Type: application/json" -H "x-public-key: diegobrota_ot7wwoy2nh99d917" -H "x-secret-key: 8ej5nonxfm9dvqzys20k9bpftn70086bt0zhxuz7j6rv2c18y40e20oaunv86q0d" -d @"test.json"`;
  const res = cp.execSync(cmd);
  console.log(res.toString());
} catch(e) {
  console.log(e.stdout ? e.stdout.toString() : e.message);
}
