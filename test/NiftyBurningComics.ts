import { expect } from 'chai';
import { ethers, upgrades, network } from 'hardhat';
import { constants } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import type { NiftyLaunchComics, NiftyKeys, NiftyItems, NiftyBurningComics } from '../typechain';

describe('NiftyBurningComics', function () {
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let comics: NiftyLaunchComics;
  let keys: NiftyKeys;
  let items: NiftyItems;
  let burning: NiftyBurningComics;
  
  let burningStartAt: number;
  let comicsTokenAmounts: Array<number>;

  const ONE_DAY = 3600 * 24;
  const FOR_KEY_BURNING = ONE_DAY * 15;

  const toRole = (role: string) => {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
  };

  const getCurrentBlockTimestamp = async () => {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
  };

  const increaseTime = async (sec: number) => {
    await network.provider.send("evm_increaseTime", [sec]);
    await network.provider.send("evm_mine");
  };

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [deployer, alice, bob] = accounts;

    // Deploy NiftyLaunchComics contracts
    const NiftyLaunchComics = await ethers.getContractFactory('NiftyLaunchComics');
    comics = await NiftyLaunchComics.deploy('https://api.nifty-league.com/launch-comics/');

    // Deploy NiftyKeys contract
    const NiftyKeys = await ethers.getContractFactory('NiftyKeys');
    keys = await NiftyKeys.deploy('https://api.nifty-league.com/keys/');

    // Deploy NiftyItems contract
    const NiftyItems = await ethers.getContractFactory('NiftyItems');
    items = await NiftyItems.deploy('https://api.nifty-league.com/items/');

    // Deploy NiftyBurningComics contract
    burningStartAt = await getCurrentBlockTimestamp();
    const NiftyBurningComics = await ethers.getContractFactory('NiftyBurningComics');
    burning = (await upgrades.deployProxy(NiftyBurningComics, [
      comics.address,
      keys.address,
      items.address,
      burningStartAt
    ])) as NiftyBurningComics;

    // mint NiftyLaunchComics
    const comicsTokenIds = [1, 2, 3, 4, 5, 6];
    comicsTokenAmounts = [10, 10, 10, 10, 10, 10];
    await comics.mintBatch(alice.address, comicsTokenIds, comicsTokenAmounts, constants.HashZero);

    // grant "MINTER_ROLE" of "NiftyKeys" and "NiftyItems" contracts to "NiftyBurningComics" contract
    const MINTER_ROLE = toRole('MINTER_ROLE');
    await keys.grantRole(MINTER_ROLE, burning.address);
    await items.grantRole(MINTER_ROLE, burning.address);
  });

  describe('burnComics', () => {
    // test scenarios for burnComics
    // 1 (isForKey = false): [0, 0, 1, 0, 0, 0]
    // 2 (isForKey = false): [1, 0, 0, 0, 0, 1]
    // 3 (isForKey = false): [1, 1, 1, 1, 1, 1]
    // 4 (isForKey = false): [3, 3, 10, 4, 5, 10]
    // 5 (isForKey = true): [0, 0, 1, 0, 0, 0]
    // 6 (isForKey = true): [1, 0, 0, 0, 0, 1]
    // 7 (isForKey = true): [1, 1, 1, 1, 1, 1]
    // 8 (isForKey = true): [3, 3, 10, 4, 5, 10]
    // 9: [1, 2, 0, 0, 0, 11] - revert: exceeded token amount
    // 10: [1, 2, 0, 0, 0] - revert: Invalid length
    // 11: revert: Burning comics is not valid

    it('burnComics - scenario 1', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [0, 0, 1, 0, 0, 0];

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i]);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(0);
    });

    it('burnComics - scenario 2', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 0, 0, 0, 0, 1];

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i]);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(0);
    });

    it('burnComics - scenario 3', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 1, 1, 1, 1, 1];

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i]);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(0);
    });

    it('burnComics - scenario 4', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [3, 3, 10, 4, 5, 10];

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i]);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(0);
    });

    it('burnComics - scenario 5', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [0, 0, 1, 0, 0, 0];

      // increase time
      await increaseTime(FOR_KEY_BURNING);

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i]);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(0);
    });

    it('burnComics - scenario 6', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 0, 0, 0, 0, 1];

      // increase time
      await increaseTime(FOR_KEY_BURNING);

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i]);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(0);
    });

    it('burnComics - scenario 7', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 1, 1, 1, 1, 1];

      // increase time
      await increaseTime(FOR_KEY_BURNING);

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(0);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(1);
    });

    it('burnComics - scenario 8', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [3, 3, 10, 4, 5, 10];

      // increase time
      await increaseTime(FOR_KEY_BURNING);

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await burning.connect(alice).burnComics(comicsValues);

      // check balance
      for (let i = 0; i < comicsTokenIds.length; i++) {
        expect(await items.balanceOf(alice.address, comicsTokenIds[i])).to.equal(comicsValues[i] - 3);
      }
      expect(await keys.balanceOf(alice.address, 1)).to.equal(3);
    });

    it('burnComics - scenario 9 (revert)', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 2, 0, 0, 0, 11];

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await expect(burning.connect(alice).burnComics(comicsValues)).to.be.revertedWith(
        'ERC1155: burn amount exceeds balance',
      );
    });

    it('burnComics - scenario 10 (revert)', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 2, 0, 0, 0];

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await expect(burning.connect(alice).burnComics(comicsValues)).to.be.revertedWith('Invalid length');
    });

    it('burnComics - scenario 11 (revert)', async function () {
      const comicsTokenIds = [1, 2, 3, 4, 5, 6];
      const comicsValues = [1, 2, 0, 0, 0, 0];

      // deploy new NiftyBurningComics contract with new burningStartAt
      const newNiftyBurningComics = await ethers.getContractFactory('NiftyBurningComics');
      const newBurning = (await upgrades.deployProxy(newNiftyBurningComics, [
        comics.address,
        keys.address,
        items.address,
        burningStartAt + ONE_DAY
      ])) as NiftyBurningComics;

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await expect(newBurning.connect(alice).burnComics(comicsValues)).to.be.revertedWith('Burning comics is not valid');

      // increase time
      await increaseTime(ONE_DAY * 31);

      // burn comics
      await comics.connect(alice).setApprovalForAll(burning.address, true);
      await expect(newBurning.connect(alice).burnComics(comicsValues)).to.be.revertedWith('Burning comics is not valid');
    });
  });

  describe('pause/unpause', () => {
    it('Pause', async () => {
      expect(await burning.paused()).to.be.false;

      // Pause burnComics
      await burning.pause();

      // check pause status
      expect(await burning.paused()).to.be.true;
    });
    it('Unpause', async () => {
      // Pause burnComics
      await burning.pause();

      // Unpause burnComics
      await burning.unpause();

      // check pause status
      expect(await burning.paused()).to.be.false;
    });
  });
});
