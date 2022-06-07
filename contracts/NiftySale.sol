// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IERC1155SupplyUpgradeable.sol";
import "./interfaces/IERC20BurnableUpgradeable.sol";
import "./interfaces/INiftyEquipment.sol";

contract NiftySale is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  event ItemPurchased(address indexed by, uint256[] itemIds, uint256[] amounts);
  event ItemPriceSet(address indexed by, uint256 itemId, uint256 oldItemPrice, uint256 newItemPrice);
  event ItemMaxCountSet(address indexed by, uint256 itemId, uint256 oldItemMaxCount, uint256 newItemMaxCount);
  event TokenPercentagesUpdated(address indexed by, uint256 oldBurnPercentage, uint256 oldTreasuryPercentage, uint256 oldDAOPercentage, uint256 newBurnPercentage, uint256 newTreasuryPercentage, uint256 newDAOPercentage);
  event NFTLWitdraw(address indexed by, uint256 burnAmount, uint256 treasuryAmount, uint256 daoAmount);

  /// @dev NiftyItems address
  address public items;

  /// @dev NFTL token address
  address public nftl;

  /// @dev ItemID -> NFTL token amount (price)
  mapping(uint256 => uint256) public itemPrices;
  
  /// @dev ItemID -> Max Count
  mapping(uint256 => uint256) public itemMaxCounts;

  /// @dev Treasury address
  address public treasury;

  /// @dev DAO address
  address public dao;

  /// @dev NFTL token burn percentage
  uint256 public burnPercentage;

  /// @dev NFTL token percentage to the treasury
  uint256 public treasuryPercentage;

  /// @dev NFTL token percentage to the DAO
  uint256 public daoPercentage;
 
  function initialize(
    address _items,
    address _nftl,
    address _treasury,
    address _dao,
    uint256 _burnPercentage,
    uint256 _treasuryPercentage,
    uint256 _daoPercentage
  ) public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __Pausable_init();

    require(_burnPercentage + _treasuryPercentage + _daoPercentage == 1000, "Invalid percentages");

    items = _items;
    nftl = _nftl;
    treasury = _treasury;
    dao = _dao;
    burnPercentage = _burnPercentage;
    treasuryPercentage = _treasuryPercentage;
    daoPercentage = _daoPercentage;
  }

  /**
   * @notice Purchase items
   * @dev User can purchase the several items at once and itemId must be greater than 6
   * @dev Item total supply can't exceed the max count
   * @dev Item price is set using the NFTL token amount
   * @param _itemIds Item ID list
   * @param _amounts Item amount list
   */
  function purchaseItems(uint256[] calldata _itemIds, uint256[] calldata _amounts) external nonReentrant whenNotPaused {
    require(_itemIds.length == _amounts.length, "Invalid params");

    // get total price
    uint256 totalPrice;
    for (uint256 i; i < _itemIds.length; i++) {
      require(_itemIds[i] > 6, "ID should be greater than 6");
      require(itemPrices[_itemIds[i]] > 0, "Zero price");
      require(IERC1155SupplyUpgradeable(items).totalSupply(_itemIds[i]) + _amounts[i] <= itemMaxCounts[_itemIds[i]], "Max count overflow");

      totalPrice += itemPrices[_itemIds[i]] * _amounts[i];
    }

    // purchase items
    IERC20Upgradeable(nftl).safeTransferFrom(msg.sender, address(this), totalPrice);
    INiftyEquipment(items).mintBatch(msg.sender, _itemIds, _amounts, bytes(""));

    emit ItemPurchased(msg.sender, _itemIds, _amounts);
  }

  /**
   * @notice Set item prices
   * @dev Only owner
   * @dev Owner can set the several item prices at once
   * @dev Item price can't be less than 1 NFTL
   * @param _itemIds Item ID list
   * @param _nftlAmounts Item price list specified by the NFTL token amounts
   */
  function setItemPrices(uint256[] calldata _itemIds, uint256[] calldata _nftlAmounts) external onlyOwner {
    require(_itemIds.length == _nftlAmounts.length, "Invalid params");

    // set the item price
    for (uint256 i; i < _itemIds.length; i++) {
      require(_nftlAmounts[i] >= 10**18, "Price smaller than 1 NFTL");
      
      emit ItemPriceSet(msg.sender, _itemIds[i], itemPrices[_itemIds[i]], _nftlAmounts[i]);

      itemPrices[_itemIds[i]] = _nftlAmounts[i];
    }
  }

  /**
   * @notice Set the item max counts
   * @dev Only owner
   * @dev Owner can set the several item max counts at once
   * @dev Max count can't be less than the current total supply
   * @param _itemIds Item ID list
   * @param _maxCounts Item max count list
   */
  function setItemMaxCounts(uint256[] calldata _itemIds, uint256[] calldata _maxCounts) external onlyOwner {
    require(_itemIds.length == _maxCounts.length, "Invalid params");

    // set the item max count
    for (uint256 i; i < _itemIds.length; i++) {
      // check if the max count is smaller than the current total supply
      require(_maxCounts[i] >= IERC1155SupplyUpgradeable(items).totalSupply(_itemIds[i]), "Max count less than total supply");

      emit ItemMaxCountSet(msg.sender, _itemIds[i], itemMaxCounts[_itemIds[i]], _maxCounts[i]);

      itemMaxCounts[_itemIds[i]] = _maxCounts[i];
    }
  }

  /**
   * @notice Update the token distribution percentages
   * @dev Only owner
   * @dev Max percentage is 1000
   * @param _burnPercentage Percentage to burn
   * @param _treasuryPercentage Percentage to the treasury address
   * @param _daoPercentage Percentage to the DAO address
   */
  function updateTokenPercentages(uint256 _burnPercentage, uint256 _treasuryPercentage, uint256 _daoPercentage) external onlyOwner {
    require(_burnPercentage + _treasuryPercentage + _daoPercentage == 1000, "Invalid percentages");

    emit TokenPercentagesUpdated(msg.sender, burnPercentage, treasuryPercentage, daoPercentage, _burnPercentage, _treasuryPercentage, _daoPercentage);

    // update the percentages
    burnPercentage = _burnPercentage;
    treasuryPercentage = _treasuryPercentage;
    daoPercentage = _daoPercentage;
  }

  /**
   * @notice Withdraw NFTL tokens locked on the contract
   * @dev Only owner
   * @dev Some of tokens are burnt and the remaing ones are transferred to the treasury and DAO addresses
   */
  function withdraw() external onlyOwner {
    uint256 nftlBalance = IERC20Upgradeable(nftl).balanceOf(address(this));
    
    // get the burnAmount, treasuryAmount and daoAmount
    uint256 burnAmount = nftlBalance * burnPercentage / 1000;
    uint256 treasuryAmount = nftlBalance * treasuryPercentage / 1000;
    uint256 daoAmount = nftlBalance - burnAmount - treasuryAmount;

    // trasnfer tokens
    IERC20BurnableUpgradeable(nftl).burn(burnAmount);
    IERC20Upgradeable(nftl).safeTransfer(treasury, treasuryAmount);
    IERC20Upgradeable(nftl).safeTransfer(dao, daoAmount);

    emit NFTLWitdraw(msg.sender, burnAmount, treasuryAmount, daoAmount);
  }

  /**
   * @notice Pause the sale
   * @dev Only owner
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpause the sale
   * @dev Only owner
   */
  function unpause() external onlyOwner {
    _unpause();
  }
}
