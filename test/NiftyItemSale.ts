import { expect } from 'chai';
import { ethers, upgrades, network } from 'hardhat';
import { BigNumber, constants } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import type { NiftyItemSale, NiftyEquipment, MockERC20 } from '../typechain';

describe('NiftySale', function () {
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let treasury: SignerWithAddress;
  let dao: SignerWithAddress;
  let itemSale: NiftyItemSale;
  let items: NiftyEquipment;
  let nftl: MockERC20;

  const ONE_ETHER = ethers.utils.parseEther("1");

  const BURN_PERCENTAGE = 200;
  const TREASURY_PERCENTAGE = 300;
  const DAO_PERCENTAGE = 500;

  const toRole = (role: string) => {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
  };

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [deployer, alice, bob, treasury, dao] = accounts;

    // Deploy NiftyLaunchComics contracts
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    nftl = await MockERC20.deploy('Mock NFTL', 'Mock NFTL');

    // Deploy NiftyItems contract
    const NiftyItems = await ethers.getContractFactory('NiftyEquipment');
    items = await NiftyItems.deploy('Nifty Items', 'NLT', 'https://api.nifty-league.com/items/');

    // Deploy NiftySale contract
    const NiftyItemSale = await ethers.getContractFactory('NiftyItemSale');
    itemSale = (await upgrades.deployProxy(NiftyItemSale, [
      items.address,
      nftl.address,
      treasury.address,
      dao.address,
      BURN_PERCENTAGE,
      TREASURY_PERCENTAGE,
      DAO_PERCENTAGE
    ])) as NiftyItemSale;

    // grant "MINTER_ROLE" of "NiftyItems" contracts to "NiftyItemSale" contract
    const MINTER_ROLE = toRole('MINTER_ROLE');
    await items.grantRole(MINTER_ROLE, itemSale.address);

    // transfer NFTL tokens to the users
    await nftl.transfer(alice.address, ONE_ETHER.mul(1000000)); // 1_000_000 NFTL
    await nftl.transfer(bob.address, ONE_ETHER.mul(1000000)); // 1_000_000 NFTL
  });

  describe('setItemPrices', () => {
    it ('Should be able to set itme prices', async () => {
      const tokenIds = [7, 8, 9];
      const tokenPrices = [ONE_ETHER.mul(100), ONE_ETHER.mul(200), ONE_ETHER.mul(300)];

      expect(await itemSale.itemPrices(tokenIds[0])).to.equal(0);
      expect(await itemSale.itemPrices(tokenIds[1])).to.equal(0);
      expect(await itemSale.itemPrices(tokenIds[2])).to.equal(0);

      // set item prices
      await itemSale.setItemPrices(tokenIds, tokenPrices);

      // check the updated item prices
      expect(await itemSale.itemPrices(tokenIds[0])).to.equal(tokenPrices[0]);
      expect(await itemSale.itemPrices(tokenIds[1])).to.equal(tokenPrices[1]);
      expect(await itemSale.itemPrices(tokenIds[2])).to.equal(tokenPrices[2]);
    });

    it ('Reverts if the params are mismatched', async () => {
      const tokenIds = [7, 8, 9, 10];
      const tokenPrices = [ONE_ETHER.mul(100), ONE_ETHER.mul(200), ONE_ETHER.mul(300)];

      // set item prices
      await expect(itemSale.setItemPrices(tokenIds, tokenPrices)).to.be.revertedWith('Mismatched params');
    });

    it ('Reverts if token ID < 7', async () => {
      const tokenIds = [6, 8, 9];
      const tokenPrices = [ONE_ETHER.mul(100), ONE_ETHER.mul(200), ONE_ETHER.mul(300)];

      // set item prices
      await expect(itemSale.setItemPrices(tokenIds, tokenPrices)).to.be.revertedWith('Token ID less than 7');
    });

    it ('Reverts if token price is less thatn 1 NFTL', async () => {
      const tokenIds = [7, 8, 9];
      const tokenPrices = [ONE_ETHER.mul(100), 200, ONE_ETHER.mul(300)];

      // set item prices
      await expect(itemSale.setItemPrices(tokenIds, tokenPrices)).to.be.revertedWith('Price less than 1 NFTL');
    });
  })

  describe('purchaseItems', () => {
    beforeEach(async () => {
      const tokenIds = [7, 8, 9];
      const tokenPrices = [ONE_ETHER.mul(100), ONE_ETHER.mul(200), ONE_ETHER.mul(300)];
      const tokenMaxCount = [100, 100, 100];

      // set item prices
      await itemSale.setItemPrices(tokenIds, tokenPrices);

      // set item max counts
      await itemSale.setItemMaxCounts(tokenIds, tokenMaxCount);
    });

    it('Should be able to purcahse items', async () => {
      const tokenIds = [7, 8, 9];
      const tokenAmounts = [1, 0, 5];

      expect(await items.balanceOf(alice.address, tokenIds[0])).to.equal(0);
      expect(await items.balanceOf(alice.address, tokenIds[1])).to.equal(0);
      expect(await items.balanceOf(alice.address, tokenIds[2])).to.equal(0);

      // get the old NFTL balance
      const aliceNFTLBalanceBefore = await nftl.balanceOf(alice.address);
      
      // purchase items
      await nftl.connect(alice).approve(itemSale.address, aliceNFTLBalanceBefore);
      await itemSale.connect(alice).purchaseItems(tokenIds, tokenAmounts);

      // get the total price
      let totalPrice = ONE_ETHER.mul('0');
      for (let i = 0; i < tokenIds.length; i++) {
        totalPrice = totalPrice.add(
          (await itemSale.itemPrices(tokenIds[i])).mul(tokenAmounts[i])
        );
      }

      // check balances
      const aliceNFTLBalanceAfter = await nftl.balanceOf(alice.address);
      expect(aliceNFTLBalanceAfter).to.equal(aliceNFTLBalanceBefore.sub(totalPrice));
      expect(await items.balanceOf(alice.address, tokenIds[0])).to.equal(tokenAmounts[0]);
      expect(await items.balanceOf(alice.address, tokenIds[1])).to.equal(tokenAmounts[1]);
      expect(await items.balanceOf(alice.address, tokenIds[2])).to.equal(tokenAmounts[2]);
    });
  });

  describe('pause/unpause', () => {
    it('Pause', async () => {
      expect(await itemSale.paused()).to.be.false;

      // Pause item sale
      await itemSale.pause();

      // check pause status
      expect(await itemSale.paused()).to.be.true;
    });
    it('Unpause', async () => {
      // Pause item sale
      await itemSale.pause();

      // Unpause burnComics
      await itemSale.unpause();

      // check pause status
      expect(await itemSale.paused()).to.be.false;
    });
  });
});
