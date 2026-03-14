const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying from', deployer.address);

  // Deploy token implementations (ERC20Token.sol exists in contracts/tokens)
  const Token = await hre.ethers.getContractFactory('ERC20Token');
  // Use explicit string for initial supply: 10000 * 10^18
  const initial = '10000000000000000000000';
  const tokenA = await Token.deploy('TokenA', 'TKA', initial);
  await tokenA.deployed();
  const tokenB = await Token.deploy('TokenB', 'TKB', initial);
  await tokenB.deployed();
  console.log('TokenA', tokenA.address);
  console.log('TokenB', tokenB.address);

  // Deploy factory
  const Factory = await hre.ethers.getContractFactory('DEXFactory');
  const factory = await Factory.deploy(deployer.address);
  await factory.deployed();
  console.log('Factory', factory.address);

  // Create pair
  await factory.createPair(tokenA.address, tokenB.address);
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
  console.log('Pair', pairAddress);

  // Approve tokens to pair and mint liquidity via pair (simple flow)
  const pair = await hre.ethers.getContractAt('DEXPair', pairAddress);
  const amt = hre.ethers.utils.parseUnits('1000', 18);
  await tokenA.approve(pairAddress, amt);
  await tokenB.approve(pairAddress, amt);
  // transfer tokens to pair contract
  await tokenA.transfer(pairAddress, amt);
  await tokenB.transfer(pairAddress, amt);
  // call mint to create liquidity tokens to deployer
  await pair.mint(deployer.address);
  console.log('Added liquidity');

  const out = { tokenA: tokenA.address, tokenB: tokenB.address, factory: factory.address, pair: pairAddress };
  const dir = path.resolve(process.cwd(), 'deployments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'local-dex.json'), JSON.stringify(out, null, 2));
  console.log('Wrote deployments/local-dex.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
