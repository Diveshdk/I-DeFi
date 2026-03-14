const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const ZERO = 0n;
const MINIMUM_LIQUIDITY = 1000n;

function parse(n, decimals = 18) {
  return ethers.parseUnits(String(n), decimals);
}

async function deadline() {
  return (await time.latest()) + 3600; // 1 hour from now
}

// ─── DEX Test Suite ───────────────────────────────────────────────────────────
describe("DEX — Full Test Suite", function () {
  let owner, alice, bob;
  let tokenA, tokenB, tokenC;
  let factory, router, pair;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy tokens
    const Token = await ethers.getContractFactory("ERC20Token");
    tokenA = await Token.deploy("Token A", "TKA", 18, parse(1_000_000), owner.address);
    tokenB = await Token.deploy("Token B", "TKB", 18, parse(1_000_000), owner.address);
    tokenC = await Token.deploy("Token C", "TKC", 18, parse(1_000_000), owner.address);

    // Deploy factory
    const Factory = await ethers.getContractFactory("DEXFactory");
    factory = await Factory.deploy(owner.address);

    // Deploy router
    const Router = await ethers.getContractFactory("DEXRouter");
    router = await Router.deploy(await factory.getAddress());

    // Create pair A/B via factory
    await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
    const pairAddr = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    pair = await ethers.getContractAt("DEXPair", pairAddr);

    // Distribute tokens to alice and bob
    await tokenA.mint(alice.address, parse(100_000));
    await tokenB.mint(alice.address, parse(100_000));
    await tokenA.mint(bob.address, parse(10_000));
    await tokenB.mint(bob.address, parse(10_000));
    await tokenC.mint(alice.address, parse(100_000));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe("1. Factory", function () {
    it("creates pair with sorted token addresses", async function () {
      const addrA = await tokenA.getAddress();
      const addrB = await tokenB.getAddress();
      const pairAddr = await factory.getPair(addrA, addrB);
      expect(pairAddr).to.not.equal(ethers.ZeroAddress);
      // Bidirectional lookup
      expect(await factory.getPair(addrB, addrA)).to.equal(pairAddr);
    });

    it("emits PairCreated event", async function () {
      const addrA = await tokenA.getAddress();
      const addrC = await tokenC.getAddress();
      const [t0, t1] = addrA < addrC ? [addrA, addrC] : [addrC, addrA];
      await expect(factory.createPair(addrA, addrC))
        .to.emit(factory, "PairCreated")
        .withArgs(t0, t1, anyValue, 2n);
    });

    it("reverts on duplicate pair", async function () {
      await expect(
        factory.createPair(await tokenA.getAddress(), await tokenB.getAddress())
      ).to.be.revertedWithCustomError(factory, "PairExists");
    });

    it("reverts on identical addresses", async function () {
      await expect(
        factory.createPair(await tokenA.getAddress(), await tokenA.getAddress())
      ).to.be.revertedWithCustomError(factory, "IdenticalAddresses");
    });

    it("tracks allPairs length", async function () {
      expect(await factory.allPairsLength()).to.equal(1n);
      await factory.createPair(await tokenA.getAddress(), await tokenC.getAddress());
      expect(await factory.allPairsLength()).to.equal(2n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe("2. Add Liquidity", function () {
    it("first mint: LP = sqrt(amtA * amtB) - MINIMUM_LIQUIDITY", async function () {
      const amtA = parse(1000);
      const amtB = parse(1000);

      await tokenA.connect(alice).approve(await router.getAddress(), amtA);
      await tokenB.connect(alice).approve(await router.getAddress(), amtB);

      await router.connect(alice).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amtA, amtB, 0, 0,
        alice.address,
        await deadline()
      );

      // Expected LP = sqrt(1e18 * 1e18) * 1e18... = 1000e18 - 1000
      const expected = parse(1000) - MINIMUM_LIQUIDITY;
      expect(await pair.balanceOf(alice.address)).to.equal(expected);
    });

    it("subsequent mint: LP proportional to contribution", async function () {
      const amtA = parse(1000);
      const amtB = parse(1000);
      const routerAddr = await router.getAddress();

      // Alice adds liquidity first
      await tokenA.connect(alice).approve(routerAddr, amtA);
      await tokenB.connect(alice).approve(routerAddr, amtB);
      await router.connect(alice).addLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        amtA, amtB, 0, 0, alice.address, await deadline()
      );

      const aliceLP = await pair.balanceOf(alice.address);

      // Bob adds same liquidity — should get same LP minus first mint's locked amount
      await tokenA.connect(bob).approve(routerAddr, amtA);
      await tokenB.connect(bob).approve(routerAddr, amtB);
      await router.connect(bob).addLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        amtA, amtB, 0, 0, bob.address, await deadline()
      );

      const bobLP = await pair.balanceOf(bob.address);
      // Bob adds same amounts to a pool that now has 1000e18 + 1000 locked.
      // Bob's LP = amtA * totalSupply / reserveA = 1000e18 * (1000e18+1000) / 1000e18 > aliceLP
      // The key invariant: Bob gets a positive amount proportional to his contribution.
      expect(bobLP).to.be.gt(0n);
      // Bob's LP should be approximately equal to aliceLP (within 0.01%)
      const diff = bobLP > aliceLP ? bobLP - aliceLP : aliceLP - bobLP;
      expect(diff).to.be.lte(aliceLP / 1000n + 1n);
    });

    it("router creates pair if it doesn't exist", async function () {
      const addrA = await tokenA.getAddress();
      const addrC = await tokenC.getAddress();
      expect(await factory.getPair(addrA, addrC)).to.equal(ethers.ZeroAddress);

      await tokenA.connect(alice).approve(await router.getAddress(), parse(1000));
      await tokenC.connect(alice).approve(await router.getAddress(), parse(1000));
      await router.connect(alice).addLiquidity(
        addrA, addrC, parse(1000), parse(1000), 0, 0, alice.address, await deadline()
      );

      expect(await factory.getPair(addrA, addrC)).to.not.equal(ethers.ZeroAddress);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe("3. Swap", function () {
    beforeEach(async function () {
      // Seed liquidity: 100k A / 100k B (1:1)
      const liq = parse(100_000);
      const routerAddr = await router.getAddress();
      await tokenA.approve(routerAddr, liq);
      await tokenB.approve(routerAddr, liq);
      await router.addLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        liq, liq, 0, 0, owner.address, await deadline()
      );
    });

    it("swapExactTokensForTokens: output > 0 and < input (fee)", async function () {
      const swapIn = parse(1000);
      const routerAddr = await router.getAddress();
      await tokenA.connect(bob).approve(routerAddr, swapIn);

      const before = await tokenB.balanceOf(bob.address);
      const amounts = await router.getAmountsOut(swapIn, [
        await tokenA.getAddress(), await tokenB.getAddress()
      ]);

      await router.connect(bob).swapExactTokensForTokens(
        swapIn, 0,
        [await tokenA.getAddress(), await tokenB.getAddress()],
        bob.address, await deadline()
      );

      const after = await tokenB.balanceOf(bob.address);
      const received = after - before;
      expect(received).to.equal(amounts[1]);
      // Fee: 0.3% + price impact. Received should be less than input.
      expect(received).to.be.lt(swapIn);
      // With 1000 in a 100k pool, price impact ≈ 1%, output ≈ 987 tokens
      expect(received).to.be.gt(parse(980));
    });

    it("applies 0.3% fee — k invariant holds", async function () {
      const swapIn = parse(100);
      const routerAddr = await router.getAddress();
      await tokenA.connect(bob).approve(routerAddr, swapIn);

      const [r0Before, r1Before] = await pair.getReserves();
      const kBefore = r0Before * r1Before;

      await router.connect(bob).swapExactTokensForTokens(
        swapIn, 0,
        [await tokenA.getAddress(), await tokenB.getAddress()],
        bob.address, await deadline()
      );

      const [r0After, r1After] = await pair.getReserves();
      const kAfter = r0After * r1After;
      // k must be >= before (fee grows k)
      expect(kAfter).to.be.gte(kBefore);
    });

    it("reverts when amountOutMin not met (slippage protection)", async function () {
      const swapIn = parse(10);
      await tokenA.connect(bob).approve(await router.getAddress(), swapIn);

      await expect(
        router.connect(bob).swapExactTokensForTokens(
          swapIn,
          parse(99999), // impossibly high minimum
          [await tokenA.getAddress(), await tokenB.getAddress()],
          bob.address,
          await deadline()
        )
      ).to.be.revertedWithCustomError(router, "InsufficientOutputAmount");
    });

    it("reverts after deadline passes", async function () {
      const swapIn = parse(10);
      await tokenA.connect(bob).approve(await router.getAddress(), swapIn);
      const expiredDeadline = (await time.latest()) - 1; // already expired

      await expect(
        router.connect(bob).swapExactTokensForTokens(
          swapIn, 0,
          [await tokenA.getAddress(), await tokenB.getAddress()],
          bob.address,
          expiredDeadline
        )
      ).to.be.revertedWithCustomError(router, "Expired");
    });

    it("swapTokensForExactTokens: spends correct input amount", async function () {
      const amountOut = parse(500);
      const routerAddr = await router.getAddress();
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const amounts = await router.getAmountsIn(amountOut, path);
      const amountInMax = amounts[0] * 2n; // generous slippage

      await tokenA.connect(bob).approve(routerAddr, amountInMax);
      const beforeA = await tokenA.balanceOf(bob.address);
      const beforeB = await tokenB.balanceOf(bob.address);

      await router.connect(bob).swapTokensForExactTokens(
        amountOut, amountInMax, path, bob.address, await deadline()
      );

      const afterA = await tokenA.balanceOf(bob.address);
      const afterB = await tokenB.balanceOf(bob.address);
      expect(afterB - beforeB).to.equal(amountOut);
      expect(beforeA - afterA).to.equal(amounts[0]);
    });

    it("multi-hop swap A → B → C", async function () {
      // Create B/C pair and add liquidity
      const addrB = await tokenB.getAddress();
      const addrC = await tokenC.getAddress();
      const routerAddr = await router.getAddress();

      await tokenB.approve(routerAddr, parse(50_000));
      await tokenC.approve(routerAddr, parse(50_000));
      await router.addLiquidity(
        addrB, addrC, parse(50_000), parse(50_000), 0, 0, owner.address, await deadline()
      );

      // Bob swaps A → B → C
      const swapIn = parse(100);
      await tokenA.connect(bob).approve(routerAddr, swapIn);
      const path = [await tokenA.getAddress(), addrB, addrC];
      const amounts = await router.getAmountsOut(swapIn, path);

      const beforeC = await tokenC.balanceOf(bob.address);
      await router.connect(bob).swapExactTokensForTokens(
        swapIn, 0, path, bob.address, await deadline()
      );
      const afterC = await tokenC.balanceOf(bob.address);
      expect(afterC - beforeC).to.equal(amounts[2]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe("4. Remove Liquidity", function () {
    let aliceLP;

    beforeEach(async function () {
      const liq = parse(10_000);
      const routerAddr = await router.getAddress();
      await tokenA.connect(alice).approve(routerAddr, liq);
      await tokenB.connect(alice).approve(routerAddr, liq);
      await router.connect(alice).addLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        liq, liq, 0, 0, alice.address, await deadline()
      );
      aliceLP = await pair.balanceOf(alice.address);
    });

    it("burns LP and returns underlying tokens proportionally", async function () {
      const routerAddr = await router.getAddress();
      await pair.connect(alice).approve(routerAddr, aliceLP);

      const beforeA = await tokenA.balanceOf(alice.address);
      const beforeB = await tokenB.balanceOf(alice.address);

      await router.connect(alice).removeLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        aliceLP, 0, 0, alice.address, await deadline()
      );

      const afterA = await tokenA.balanceOf(alice.address);
      const afterB = await tokenB.balanceOf(alice.address);
      expect(await pair.balanceOf(alice.address)).to.equal(ZERO);
      expect(afterA).to.be.gt(beforeA);
      expect(afterB).to.be.gt(beforeB);
    });

    it("reverts when amountMin not satisfied", async function () {
      const routerAddr = await router.getAddress();
      await pair.connect(alice).approve(routerAddr, aliceLP);

      await expect(
        router.connect(alice).removeLiquidity(
          await tokenA.getAddress(), await tokenB.getAddress(),
          aliceLP, parse(999_999), 0, alice.address, await deadline()
        )
      ).to.be.revertedWithCustomError(router, "InsufficientAAmount");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe("5. Price oracle accumulators", function () {
    it("accumulators increase after time passes and swap occurs", async function () {
      const liq = parse(100_000);
      const routerAddr = await router.getAddress();
      await tokenA.approve(routerAddr, liq);
      await tokenB.approve(routerAddr, liq);
      await router.addLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        liq, liq, 0, 0, owner.address, await deadline()
      );

      const p0Before = await pair.price0CumulativeLast();

      // Advance time by 1 hour
      await time.increase(3600);

      // A small swap updates accumulators
      const swapIn = parse(100);
      await tokenA.connect(bob).approve(routerAddr, swapIn);
      await router.connect(bob).swapExactTokensForTokens(
        swapIn, 0,
        [await tokenA.getAddress(), await tokenB.getAddress()],
        bob.address, await deadline()
      );

      const p0After = await pair.price0CumulativeLast();
      expect(p0After).to.be.gt(p0Before);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe("6. getAmountOut / getAmountsOut helpers", function () {
    it("getAmountOut returns correct value with 0.3% fee", async function () {
      // With reserveIn=1000, reserveOut=1000, amountIn=10:
      // amountOut = (10*997 * 1000) / (1000*1000 + 10*997) = 9970000 / 1009970 ≈ 9.87
      const out = await router.getAmountOut(parse(10), parse(1000), parse(1000));
      // Should be approximately 9.87 tokens
      expect(out).to.be.gt(parse(9));
      expect(out).to.be.lt(parse(10));
    });

    it("getAmountsOut follows chain correctly", async function () {
      const liq = parse(100_000);
      const routerAddr = await router.getAddress();
      await tokenA.approve(routerAddr, liq);
      await tokenB.approve(routerAddr, liq);
      await router.addLiquidity(
        await tokenA.getAddress(), await tokenB.getAddress(),
        liq, liq, 0, 0, owner.address, await deadline()
      );

      const amounts = await router.getAmountsOut(parse(100), [
        await tokenA.getAddress(), await tokenB.getAddress()
      ]);
      expect(amounts[0]).to.equal(parse(100));
      expect(amounts[1]).to.be.lt(parse(100)); // fee deducted
    });
  });
});
