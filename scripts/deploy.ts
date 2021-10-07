// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network, tenderly } from 'hardhat';
import chalk from 'chalk';

const targetNetwork = network.name;

// If you want to verify on https://tenderly.co/
// eslint-disable-next-line consistent-return
const tenderlyVerify = async ({
  contractName,
  contractAddress,
}: {
  contractName: string;
  contractAddress: unknown[];
}) => {
  const tenderlyNetworks = ['kovan', 'goerli', 'mainnet', 'rinkeby', 'ropsten', 'matic', 'mumbai', 'xDai', 'POA'];

  if (tenderlyNetworks.includes(targetNetwork)) {
    console.log(chalk.blue(` 📁 Attempting tenderly verification of ${contractName} on ${targetNetwork}`));
    await tenderly.persistArtifacts({
      name: contractName,
      address: contractAddress,
    });
    const verification = await tenderly.verify({
      name: contractName,
      address: contractAddress,
      network: targetNetwork,
    });
    return verification;
  }
  console.log(chalk.grey(` 🧐 Contract verification not supported on ${targetNetwork}`));
};

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const NiftyComics = await ethers.getContractFactory('NiftyComics');
  const comics = await NiftyComics.deploy('Hello, Hardhat!');

  await comics.deployed();

  console.log('NiftyComics deployed to:', comics.address);

  await tenderlyVerify({
    contractName: 'NiftyComics',
    contractAddress: comics.address,
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
