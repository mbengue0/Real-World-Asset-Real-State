import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("PaymentToken", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const PaymentToken = await ethers.getContractFactory("PaymentToken");
    const token = await PaymentToken.deploy("RealtyUSD", "rUSD", owner.address);
    return { token, owner, alice, bob };
  }

  describe("deployment", function () {
    it("sets name, symbol, and 18 decimals", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("RealtyUSD");
      expect(await token.symbol()).to.equal("rUSD");
      expect(await token.decimals()).to.equal(18);
    });

    it("assigns deployer-specified initial owner", async function () {
      const { token, owner } = await loadFixture(deployFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("starts with zero total supply", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.totalSupply()).to.equal(0n);
    });
  });

  describe("mint", function () {
    it("owner can mint to an address", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      await expect(token.connect(owner).mint(alice.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("non-owner cannot mint", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(token.connect(alice).mint(bob.address, 1n))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });

    it("reverts when minting to the zero address", async function () {
      const { token, owner } = await loadFixture(deployFixture);
      await expect(token.connect(owner).mint(ethers.ZeroAddress, 1n))
        .to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("reverts when minting zero amount", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      await expect(token.connect(owner).mint(alice.address, 0n))
        .to.be.revertedWithCustomError(token, "ZeroAmount");
    });
  });

  describe("ERC-20 behaviour", function () {
    it("standard transfer moves balance", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("50");
      await token.connect(owner).mint(alice.address, amount);
      await token.connect(alice).transfer(bob.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("transfer with insufficient balance reverts via OZ ERC20InsufficientBalance", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(token.connect(alice).transfer(bob.address, 1n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });
});
