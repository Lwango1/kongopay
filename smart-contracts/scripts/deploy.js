const hre = require('hardhat');

async function main() {
  const treasuryWallet = process.env.TREASURY_WALLET;
  if (!treasuryWallet) {
    console.error('Set TREASURY_WALLET in .env');
    process.exit(1);
  }

  const KongoToken = await hre.ethers.getContractFactory('KongoToken');
  const token = await KongoToken.deploy(treasuryWallet);

  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log(`KongoToken deployed to: ${address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Treasury: ${treasuryWallet}`);
  console.log(`Initial supply: 100,000,000 KONG`);
  console.log(`Max supply: 1,000,000,000 KONG`);
}

main().catch(console.error);
