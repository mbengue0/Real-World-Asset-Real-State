import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const STATUS_LISTED = 0n;
const STATUS_SOLD_OUT = 1n;
const STATUS_DELISTED = 2n;

describe("PropertyFactory", function () {
  // ─────────────────────────────────────────────────────────────────────
  //  Fixtures
  // ─────────────────────────────────────────────────────────────────────

  async function deployedFixture() {
    const [owner, seller, buyer, other] = await ethers.getSigners();

    const PaymentToken = await ethers.getContractFactory("PaymentToken");
    const paymentToken = await PaymentToken.deploy("RealtyUSD", "rUSD", owner.address);

    const PropertyFactory = await ethers.getContractFactory("PropertyFactory");
    const factory = await PropertyFactory.deploy(await paymentToken.getAddress(), owner.address);

    // Pre-fund the buyer with PaymentToken
    const buyerBalance = ethers.parseEther("1000000");
    await paymentToken.mint(buyer.address, buyerBalance);

    return { paymentToken, factory, owner, seller, buyer, other, buyerBalance };
  }

  async function listedFixture() {
    const base = await deployedFixture();
    const { factory, seller } = base;
    const totalShares = 100n;
    const pricePerShare = ethers.parseEther("10"); // 10 rUSD per share
    const metadataURI = "ipfs://QmDemoCID";

    const tx = await factory.listProperty(seller.address, totalShares, pricePerShare, metadataURI);
    await tx.wait();

    const property = await factory.getProperty(1);
    const PropertyShare = await ethers.getContractFactory("PropertyShare");
    const share = PropertyShare.attach(property.shareContract);

    return { ...base, share, totalShares, pricePerShare, metadataURI, propertyId: 1n };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Constructor
  // ─────────────────────────────────────────────────────────────────────

  describe("constructor", function () {
    it("stores paymentToken and owner", async function () {
      const { factory, paymentToken, owner } = await loadFixture(deployedFixture);
      expect(await factory.paymentToken()).to.equal(await paymentToken.getAddress());
      expect(await factory.owner()).to.equal(owner.address);
      expect(await factory.totalProperties()).to.equal(0n);
    });

    it("reverts on zero paymentToken", async function () {
      const [owner] = await ethers.getSigners();
      const PropertyFactory = await ethers.getContractFactory("PropertyFactory");
      await expect(PropertyFactory.deploy(ethers.ZeroAddress, owner.address))
        .to.be.revertedWithCustomError(PropertyFactory, "ZeroAddress");
    });

    it("reverts on zero owner via OZ OwnableInvalidOwner", async function () {
      const PropertyFactory = await ethers.getContractFactory("PropertyFactory");
      const PaymentToken = await ethers.getContractFactory("PaymentToken");
      const [deployer] = await ethers.getSigners();
      const token = await PaymentToken.deploy("X", "X", deployer.address);
      await expect(PropertyFactory.deploy(await token.getAddress(), ethers.ZeroAddress))
        .to.be.revertedWithCustomError(PropertyFactory, "OwnableInvalidOwner");
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  //  listProperty
  // ─────────────────────────────────────────────────────────────────────

  describe("listProperty", function () {
    it("non-owner cannot list", async function () {
      const { factory, seller, other } = await loadFixture(deployedFixture);
      await expect(
        factory.connect(other).listProperty(seller.address, 10n, 1n, "ipfs://x")
      )
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });

    it("reverts on zero seller", async function () {
      const { factory } = await loadFixture(deployedFixture);
      await expect(factory.listProperty(ethers.ZeroAddress, 10n, 1n, "ipfs://x"))
        .to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("reverts on zero totalShares", async function () {
      const { factory, seller } = await loadFixture(deployedFixture);
      await expect(factory.listProperty(seller.address, 0n, 1n, "ipfs://x"))
        .to.be.revertedWithCustomError(factory, "InvalidShares")
        .withArgs(0n);
    });

    it("reverts on zero pricePerShare", async function () {
      const { factory, seller } = await loadFixture(deployedFixture);
      await expect(factory.listProperty(seller.address, 10n, 0n, "ipfs://x"))
        .to.be.revertedWithCustomError(factory, "InvalidPrice");
    });

    it("emits PropertyListed with the right args", async function () {
      const { factory, seller } = await loadFixture(deployedFixture);
      const totalShares = 25n;
      const pricePerShare = ethers.parseEther("5");
      const metadataURI = "ipfs://QmFirst";

      // We don't know the shareContract address in advance; use a custom matcher
      const tx = await factory.listProperty(seller.address, totalShares, pricePerShare, metadataURI);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try {
            return factory.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "PropertyListed");

      expect(event).to.not.be.null;
      expect(event!.args.propertyId).to.equal(1n);
      expect(event!.args.seller).to.equal(seller.address);
      expect(event!.args.totalShares).to.equal(totalShares);
      expect(event!.args.pricePerShare).to.equal(pricePerShare);
      expect(event!.args.metadataURI).to.equal(metadataURI);
      expect(event!.args.shareContract).to.match(/^0x[0-9a-fA-F]{40}$/);
    });

    it("increments propertyId starting at 1", async function () {
      const { factory, seller } = await loadFixture(deployedFixture);
      await factory.listProperty(seller.address, 10n, 1n, "ipfs://a");
      await factory.listProperty(seller.address, 20n, 2n, "ipfs://b");
      expect(await factory.totalProperties()).to.equal(2n);
      expect((await factory.getProperty(1)).metadataURI).to.equal("ipfs://a");
      expect((await factory.getProperty(2)).metadataURI).to.equal("ipfs://b");
    });

    it("stores the property struct correctly", async function () {
      const { factory, seller, totalShares, pricePerShare, metadataURI } =
        await loadFixture(listedFixture);
      const p = await factory.getProperty(1);
      expect(p.shareContract).to.not.equal(ethers.ZeroAddress);
      expect(p.pricePerShare).to.equal(pricePerShare);
      expect(p.seller).to.equal(seller.address);
      expect(p.totalShares).to.equal(totalShares);
      expect(p.sharesSold).to.equal(0n);
      expect(p.status).to.equal(STATUS_LISTED);
      expect(p.metadataURI).to.equal(metadataURI);
    });

    it("deploys a PropertyShare with correct name, symbol, decimals, supply", async function () {
      const { factory, share, totalShares } = await loadFixture(listedFixture);
      expect(await share.name()).to.equal("PropertyShare #1");
      expect(await share.symbol()).to.equal("PS1");
      expect(await share.decimals()).to.equal(0);
      expect(await share.totalSupply()).to.equal(totalShares);
      expect(await share.balanceOf(await factory.getAddress())).to.equal(totalShares);
      expect(await share.factory()).to.equal(await factory.getAddress());
      expect(await share.propertyId()).to.equal(1n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  //  buyShares
  // ─────────────────────────────────────────────────────────────────────

  describe("buyShares", function () {
    it("happy path: routes payment to seller and shares to buyer", async function () {
      const { factory, paymentToken, share, buyer, seller, pricePerShare } =
        await loadFixture(listedFixture);

      const sharesToBuy = 7n;
      const totalCost = sharesToBuy * pricePerShare;

      await paymentToken.connect(buyer).approve(await factory.getAddress(), totalCost);

      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      const buyerBalanceBefore = await paymentToken.balanceOf(buyer.address);

      await expect(factory.connect(buyer).buyShares(1, sharesToBuy))
        .to.emit(factory, "SharesPurchased")
        .withArgs(1n, buyer.address, sharesToBuy, totalCost);

      expect(await share.balanceOf(buyer.address)).to.equal(sharesToBuy);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(sellerBalanceBefore + totalCost);
      expect(await paymentToken.balanceOf(buyer.address)).to.equal(buyerBalanceBefore - totalCost);

      const p = await factory.getProperty(1);
      expect(p.sharesSold).to.equal(sharesToBuy);
      expect(p.status).to.equal(STATUS_LISTED);
    });

    it("reverts on zero shares with InvalidShares(0)", async function () {
      const { factory, buyer } = await loadFixture(listedFixture);
      await expect(factory.connect(buyer).buyShares(1, 0))
        .to.be.revertedWithCustomError(factory, "InvalidShares")
        .withArgs(0n);
    });

    it("reverts on non-existent propertyId with PropertyNotListed", async function () {
      const { factory, buyer } = await loadFixture(listedFixture);
      await expect(factory.connect(buyer).buyShares(999, 1))
        .to.be.revertedWithCustomError(factory, "PropertyNotListed")
        .withArgs(999n);
    });

    it("reverts when buying more than available with InsufficientShareSupply", async function () {
      const { factory, buyer, totalShares } = await loadFixture(listedFixture);
      await expect(factory.connect(buyer).buyShares(1, totalShares + 1n))
        .to.be.revertedWithCustomError(factory, "InsufficientShareSupply")
        .withArgs(totalShares + 1n, totalShares);
    });

    it("reverts without approval (OZ ERC20InsufficientAllowance bubbles via SafeERC20)", async function () {
      const { factory, paymentToken, buyer } = await loadFixture(listedFixture);
      await expect(factory.connect(buyer).buyShares(1, 1))
        .to.be.revertedWithCustomError(paymentToken, "ERC20InsufficientAllowance");
    });

    it("reverts on insufficient buyer balance (OZ ERC20InsufficientBalance)", async function () {
      const { factory, paymentToken, buyer, seller, buyerBalance } =
        await loadFixture(listedFixture);

      // List a second property whose single-share price exceeds the buyer's entire balance
      const expensivePrice = buyerBalance + 1n;
      await factory.listProperty(seller.address, 10n, expensivePrice, "ipfs://expensive");

      await paymentToken.connect(buyer).approve(await factory.getAddress(), ethers.MaxUint256);
      await expect(factory.connect(buyer).buyShares(2, 1))
        .to.be.revertedWithCustomError(paymentToken, "ERC20InsufficientBalance");
    });

    it("flips status to SoldOut when last share is bought", async function () {
      const { factory, paymentToken, buyer, totalShares, pricePerShare } =
        await loadFixture(listedFixture);

      const totalCost = totalShares * pricePerShare;
      await paymentToken.connect(buyer).approve(await factory.getAddress(), totalCost);
      await factory.connect(buyer).buyShares(1, totalShares);

      const p = await factory.getProperty(1);
      expect(p.sharesSold).to.equal(totalShares);
      expect(p.status).to.equal(STATUS_SOLD_OUT);
    });

    it("cannot buy from a sold-out property", async function () {
      const { factory, paymentToken, buyer, totalShares, pricePerShare } =
        await loadFixture(listedFixture);

      const totalCost = totalShares * pricePerShare;
      await paymentToken.connect(buyer).approve(await factory.getAddress(), totalCost);
      await factory.connect(buyer).buyShares(1, totalShares);

      await expect(factory.connect(buyer).buyShares(1, 1))
        .to.be.revertedWithCustomError(factory, "PropertyNotListed")
        .withArgs(1n);
    });

    it("multiple partial buys accumulate sharesSold correctly", async function () {
      const { factory, paymentToken, share, buyer, pricePerShare } =
        await loadFixture(listedFixture);

      await paymentToken
        .connect(buyer)
        .approve(await factory.getAddress(), ethers.MaxUint256);

      await factory.connect(buyer).buyShares(1, 10);
      await factory.connect(buyer).buyShares(1, 15);
      await factory.connect(buyer).buyShares(1, 25);

      const p = await factory.getProperty(1);
      expect(p.sharesSold).to.equal(50n);
      expect(p.status).to.equal(STATUS_LISTED);
      expect(await share.balanceOf(buyer.address)).to.equal(50n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  //  delistProperty
  // ─────────────────────────────────────────────────────────────────────

  describe("delistProperty", function () {
    it("owner can delist a listed property", async function () {
      const { factory } = await loadFixture(listedFixture);
      await expect(factory.delistProperty(1))
        .to.emit(factory, "PropertyDelisted")
        .withArgs(1n);
      expect((await factory.getProperty(1)).status).to.equal(STATUS_DELISTED);
    });

    it("non-owner cannot delist", async function () {
      const { factory, other } = await loadFixture(listedFixture);
      await expect(factory.connect(other).delistProperty(1))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });

    it("reverts on non-existent property", async function () {
      const { factory } = await loadFixture(deployedFixture);
      await expect(factory.delistProperty(99))
        .to.be.revertedWithCustomError(factory, "PropertyNotListed")
        .withArgs(99n);
    });

    it("reverts when re-delisting", async function () {
      const { factory } = await loadFixture(listedFixture);
      await factory.delistProperty(1);
      await expect(factory.delistProperty(1))
        .to.be.revertedWithCustomError(factory, "AlreadyDelisted")
        .withArgs(1n);
    });

    it("blocks further purchases after delisting", async function () {
      const { factory, paymentToken, buyer, pricePerShare } = await loadFixture(listedFixture);
      await factory.delistProperty(1);
      await paymentToken.connect(buyer).approve(await factory.getAddress(), pricePerShare);
      await expect(factory.connect(buyer).buyShares(1, 1))
        .to.be.revertedWithCustomError(factory, "PropertyNotListed")
        .withArgs(1n);
    });
  });
});
