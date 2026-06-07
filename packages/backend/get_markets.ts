import axios from 
;

const ENDPOINT = 'https://api.goldsky.com/api/public/project_cmq17mffxi3ym01zj0wsd8eib/subgraphs/omnicurve-amm-arbitrum-sepolia/1.0.2/gn';

async function main() {
  const query = `
    {
      __schema {
        types {
          name
        }
      }
    }
  `;

  try {
    const res = await axios.post(ENDPOINT, { query });
    console.log(JSON.stringify(res.data.data.__schema.types.filter(t => t.name.endsWith('s') || t.name.includes('Market')), null, 2));
  } catch (e) {
    console.error(e);
  }
}

main();
