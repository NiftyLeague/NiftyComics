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

  /// @dev NiftyLaunchComics burning start time
  uint256 public comicsBurningStartAt;

  /// @dev NiftyKeys mint start time
  uint256 public mintNiftyKeysStartAt;

  /// @dev NiftyLaunchComics burning end time
  uint256 public comicsBurningEndAt;

  function initialize(
    address _comics,
    address _keys,
    address _items,
    uint256 _comicsBurningStartAt
  ) public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __ReentrancyGuard_init();

    comics = _comics;
    keys = _keys;
    items = _items;
    comicsBurningStartAt = _comicsBurningStartAt;
    mintNiftyKeysStartAt = _comicsBurningStartAt + 3600 * 24 * 15;  // 15 days period
    comicsBurningEndAt = _comicsBurningStartAt + 3600 * 24 * 30;  // 30 days period
  }

  /**
   * @notice Burn comics and returns the items associated with its page
   * @dev User can burn all 6 comics at once to receive a key to the citadel
   * @dev Burning comics are available only for 30 days
   * @dev Key should be minted only for the last 15 days out of 30 days
   * @param _values Number of comics to burn, nth value means the number of nth comics(tokenId = n) to burn
   */
  function burnComics(uint256[] memory _values) external nonReentrant whenNotPaused {
    // check if burning comics is valid
    require(comicsBurningStartAt <= block.timestamp && block.timestamp <= comicsBurningEndAt, "Burning comics is not valid");

    // check _values param
    require(_values.length == 6, "Invalid length");

    // tokenIds and values to be minted
    uint256[] memory tokenIds = new uint256[](6);
    uint256[] memory tokenNumbersForItems = new uint256[](6);

    bool isForKeys = mintNiftyKeysStartAt < block.timestamp;

    // get tokenIds and the number of keys to mint
    uint256 valueForKeys = isForKeys ? type(uint256).max : 0;
    for (uint256 i; i < _values.length; i++) {
      if (isForKeys) { // burning comics for keys
        // get the min value in _values
        if (_values[i] < valueForKeys) valueForKeys = _values[i];
      }

      // set tokenIds
      tokenIds[i] = i + 1;
    }

    // in case of the keys should be minted, set the number of items to be minted
    if (valueForKeys != 0) {
      for (uint256 i; i < _values.length; i++) {
        tokenNumbersForItems[i] = _values[i] - valueForKeys;
      }
    }

    // burn comics
    INiftyLaunchComics(comics).burnBatch(msg.sender, tokenIds, _values);
    emit ComicsBurned(msg.sender, tokenIds, _values);

    // mint the keys and items
    if (valueForKeys != 0) {
      // mint the key and items
      INiftyKeys(keys).mint(msg.sender, 1, valueForKeys, "");
      INiftyItems(items).mintBatch(msg.sender, tokenIds, tokenNumbersForItems, "");

      emit KeyMinted(msg.sender, 1, valueForKeys);
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
