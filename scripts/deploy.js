const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CrossDEX Deployment Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Deployer  :", deployer.address);
  console.log("Network   :", network.name);
  console.log("Chain ID  :", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const Token = await ethers.getContractFactory("ERC20Token");

  // ── 1. Deploy Real-Named ERC20 Tokens ───────────────────────────────────────
  console.log("\n[1/4] Deploying tokens...");

  // WETH: 18 decimals, 10,000 supply (1 WETH ~ $3500)
  const weth = await Token.deploy(
    "Wrapped Ether", "WETH", 18,
    ethers.parseUnits("10000", 18),
    deployer.address
  );
  await weth.waitForDeployment();
  console.log("  WETH (Wrapped Ether) :", await weth.getAddress());

  // USDT: 6 decimals, 35,000,000 supply (keeps $ peg; 10000 WETH worth of USDT)
  const usdt = await Token.deploy(
    "Tether USD", "USDT", 6,
    ethers.parseUnits("35000000", 6),
    deployer.address
  );
  await usdt.waitForDeployment();
  console.log("  USDT (Tether USD)    :", await usdt.getAddress());

  // USDC: 6 decimals, 35,000,000 supply
  const usdc = await Token.deploy(
    "USD Coin", "USDC", 6,
    ethers.parseUnits("35000000", 6),
    deployer.address
  );
  await usdc.waitForDeployment();
  console.log("  USDC (USD Coin)      :", await usdc.getAddress());

  // WBTC: 8 decimals, 500 supply (1 WBTC ~ $95000)
  const wbtc = await Token.deploy(
    "Wrapped Bitcoin", "WBTC", 8,
    ethers.parseUnits("500", 8),
    deployer.address
  );
  await wbtc.waitForDeployment();
  console.log("  WBTC (Wrapped BTC)   :", await wbtc.getAddress());

  // SOL: 9 decimals, 5,000,000 supply (1 SOL ~ $175)
  const sol = await Token.deploy(
    "Solana (Wrapped)", "SOL", 9,
    ethers.parseUnits("5000000", 9),
    deployer.address
  );
  await sol.waitForDeployment();
  console.log("  SOL  (Solana)        :", await sol.getAddress());

  // ── 2. Deploy Factory ────────────────────────────────────────────────────
  console.log("\n[2/4] Deploying DEXFactory...");
  const Factory = await ethers.getContractFactory("DEXFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  console.log("  DEXFactory   :", await factory.getAddress());

  // ── 3. Deploy Router ─────────────────────────────────────────────────────
  console.log("\n[3/4] Deploying DEXRouter...");
  const Router = await ethers.getContractFactory("DEXRouter");
  const router = await Router.deploy(await factory.getAddress());
  await router.waitForDeployment();
  console.log("  DEXRouter    :", await router.getAddress());

  const routerAddr = await router.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // ── 4. Create pairs & seed liquidity at realistic price ratios ────────────
  console.log("\n[4/4] Creating pairs and seeding liquidity...");

  // --- WETH / USDT: 1 WETH = 3500 USDT ---
  const WETH_LIQ   = ethers.parseUnits("1000", 18);   // 1000 WETH
  const USDT_LIQ   = ethers.parseUnits("3500000", 6); // 3,500,000 USDT
  await weth.approve(routerAddr, WETH_LIQ);
  await usdt.approve(routerAddr, USDT_LIQ);
  await (await router.addLiquidity(
    await weth.getAddress(), await usdt.getAddress(),
    WETH_LIQ, USDT_LIQ, 0, 0, deployer.address, deadline
  )).wait();
  const pairWETH_USDT = await factory.getPair(await weth.getAddress(), await usdt.getAddress());
  console.log("  Pair WETH/USDT :", pairWETH_USDT);

  // --- WETH / USDC: 1 WETH = 3500 USDC ---
  const USDC_LIQ   = ethers.parseUnits("1750000", 6); // 1,750,000 USDC
  const WETH_LIQ2  = ethers.parseUnits("500", 18);    // 500 WETH
  await weth.approve(routerAddr, WETH_LIQ2);
  await usdc.approve(routerAddr, USDC_LIQ);
  await (await router.addLiquidity(
    await weth.getAddress(), await usdc.getAddress(),
    WETH_LIQ2, USDC_LIQ, 0, 0, deployer.address, deadline
  )).wait();
  const pairWETH_USDC = await factory.getPair(await weth.getAddress(), await usdc.getAddress());
  console.log("  Pair WETH/USDC :", pairWETH_USDC);

  // --- WBTC / USDT: 1 WBTC = 95000 USDT ---
  const WBTC_LIQ   = ethers.parseUnits("100", 8);        // 100 WBTC
  const USDT_LIQ2  = ethers.parseUnits("9500000", 6);    // 9,500,000 USDT
  await wbtc.approve(routerAddr, WBTC_LIQ);
  await usdt.approve(routerAddr, USDT_LIQ2);
  await (await router.addLiquidity(
    await wbtc.getAddress(), await usdt.getAddress(),
    WBTC_LIQ, USDT_LIQ2, 0, 0, deployer.address, deadline
  )).wait();
  const pairWBTC_USDT = await factory.getPair(await wbtc.getAddress(), await usdt.getAddress());
  console.log("  Pair WBTC/USDT :", pairWBTC_USDT);

  // --- SOL / USDT: 1 SOL = 175 USDT ---
  const SOL_LIQ    = ethers.parseUnits("100000", 9);   // 100,000 SOL
  const USDT_LIQ3  = ethers.parseUnits("17500000", 6); // 17,500,000 USDT
  await sol.approve(routerAddr, SOL_LIQ);
  await usdt.approve(routerAddr, USDT_LIQ3);
  await (await router.addLiquidity(
    await sol.getAddress(), await usdt.getAddress(),
    SOL_LIQ, USDT_LIQ3, 0, 0, deployer.address, deadline
  )).wait();
  const pairSOL_USDT = await factory.getPair(await sol.getAddress(), await usdt.getAddress());
  console.log("  Pair SOL/USDT  :", pairSOL_USDT);

  // --- WETH / WBTC: 1 WBTC = ~27.14 WETH (95000/3500) ---
  const WETH_LIQ3  = ethers.parseUnits("271.4", 18);  // 271.4 WETH
  const WBTC_LIQ2  = ethers.parseUnits("10", 8);      // 10 WBTC
  await weth.approve(routerAddr, WETH_LIQ3);
  await wbtc.approve(routerAddr, WBTC_LIQ2);
  await (await router.addLiquidity(
    await weth.getAddress(), await wbtc.getAddress(),
    WETH_LIQ3, WBTC_LIQ2, 0, 0, deployer.address, deadline
  )).wait();
  const pairWETH_WBTC = await factory.getPair(await weth.getAddress(), await wbtc.getAddress());
  console.log("  Pair WETH/WBTC :", pairWETH_WBTC);

  // ── Save addresses ────────────────────────────────────────────────────────
  const addresses = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    contracts: {
      tokenWETH: await weth.getAddress(),
      tokenUSDT: await usdt.getAddress(),
      tokenUSDC: await usdc.getAddress(),
      tokenWBTC: await wbtc.getAddress(),
      tokenSOL:  await sol.getAddress(),
      factory: await factory.getAddress(),
      router:  await router.getAddress(),
      pairs: {
        "WETH-USDT": pairWETH_USDT,
        "WETH-USDC": pairWETH_USDC,
        "WBTC-USDT": pairWBTC_USDT,
        "SOL-USDT":  pairSOL_USDT,
        "WETH-WBTC": pairWETH_WBTC,
      }
    }
  };

  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\n✓ Addresses saved →", outPath);

  const frontendPath = path.join(__dirname, "..", "dex", "deployed-addresses.json");
  fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
  console.log("✓ Addresses copied → dex/deployed-addresses.json");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deployment complete! 5 tokens, 5 pairs seeded.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
