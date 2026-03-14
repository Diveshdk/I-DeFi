import hre from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying from', deployer.address);

  const TokenA = await hre.ethers.getContractFactory('TokenA');
  const TokenB = await hre.ethers.getContractFactory('TokenB');
  const initial = hre.ethers.utils.parseUnits('10000', 18);
  const tokenA = await TokenA.deploy(initial);
  const tokenB = await TokenB.deploy(initial);
  await tokenA.deployed();
  await tokenB.deployed();
  console.log('TokenA', tokenA.address);
  console.log('TokenB', tokenB.address);

  const Dex = await hre.ethers.getContractFactory('SimpleDex');
  const dex = await Dex.deploy(tokenA.address, tokenB.address);
  await dex.deployed();
  console.log('Dex', dex.address);

  // write deployments
  const out = {
    tokenA: tokenA.address,
    tokenB: tokenB.address,
    dex: dex.address
  };
  const deploymentsDir = path.resolve(process.cwd(), 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  fs.writeFileSync(path.join(deploymentsDir, 'local.json'), JSON.stringify(out, null, 2));
  console.log('Wrote deployments/local.json');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
