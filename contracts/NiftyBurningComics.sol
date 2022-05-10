// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./interfaces/INiftyLaunchComics.sol";
import "./interfaces/INiftyKeys.sol";
import "./interfaces/INiftyItems.sol";

contract NiftyBurningComics is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
  event ComicsBurned(address indexed by, uint256[] tokenIds, uint256[] values);
  event KeyMinted(address indexed by, uint256 tokenId, uint256 value);
  event ItemMinted(address indexed by, uint256[] tokenIds, uint256[] values);

  /// @dev NiftyLaunchComics address
  address public comics;

  /// @dev NiftyKeys address
  address public keys;

  /// @dev NiftyItems address
  address public items;

  function initialize(
    address _comics,
    address _keys,
    address _items
  ) public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __ReentrancyGuard_init();

    comics = _comics;
    keys = _keys;
    items = _items;
  }

  /**
   * @notice Burn comics and returns the items associated with its page
   * @dev User can burn all 6 comics at once to receive a key to the citadel.
   * @param _values Number of comics to burn, nth value means the number of nth comics(tokenId = n) to burn
   */
  function burnComics(uint256[] memory _values) external nonReentrant whenNotPaused {
    // check _values param
    require(_values.length == 6, "Invalid length");

    // tokenIds and values to be minted
    uint256[] memory tokenIds = new uint256[](6);
    uint256[] memory tokenNumbersForItems = new uint256[](6);

    // check if all comics will be burned
    bool isAllComicsBurning = true;
    for (uint256 i; i < _values.length; i++) {
      // check if there is the comic not to be burned for the key
      if (_values[i] != 0) {
        // in case of the key should be minted, set the number of items to be minted
        tokenNumbersForItems[i] = _values[i] - 1;
      } else {
        isAllComicsBurning = false;
      }

      // in case of the key should be minted, set tokenIds for items
      tokenIds[i] = i + 1;
    }

    // burn comics
    INiftyLaunchComics(comics).burnBatch(msg.sender, tokenIds, _values);
    emit ComicsBurned(msg.sender, tokenIds, _values);

    // mint the key and items
    if (isAllComicsBurning) {
      // mint the key and items
      INiftyKeys(keys).mint(msg.sender, 1, 1, "");
      INiftyItems(items).mintBatch(msg.sender, tokenIds, tokenNumbersForItems, "");

      emit KeyMinted(msg.sender, 1, 1);
      emit ItemMinted(msg.sender, tokenIds, tokenNumbersForItems);
    } else {
      // mint items
      INiftyItems(items).mintBatch(msg.sender, tokenIds, _values, "");

      emit ItemMinted(msg.sender, tokenIds, _values);
    }
  }

  /**
   * @notice Pause comics burning
   * @dev Only owner
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpause comics burning
   * @dev Only owner
   */
  function unpause() external onlyOwner {
    _unpause();
  }
}
