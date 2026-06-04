// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

contract KongoToken is ERC20, Ownable, ERC20Burnable, ERC20Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10 ** 18;
    uint256 public constant TRADING_REWARD_RATE = 10;
    uint256 public constant STAKING_APR = 500;

    mapping(address => StakeInfo) public stakes;
    address public treasuryWallet;

    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
    }

    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount, uint256 reward);
    event TreasuryUpdated(address indexed newTreasury);

    constructor(address _treasuryWallet) ERC20("KongoPay Token", "KONG") Ownable(msg.sender) {
        require(_treasuryWallet != address(0), "Treasury cannot be zero");
        treasuryWallet = _treasuryWallet;
        _mint(_treasuryWallet, INITIAL_SUPPLY);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        if (stakes[msg.sender].amount > 0) {
            _claimReward(msg.sender);
        }

        _transfer(msg.sender, address(this), amount);
        stakes[msg.sender] = StakeInfo({
            amount: stakes[msg.sender].amount + amount,
            startTime: block.timestamp
        });

        emit TokensStaked(msg.sender, amount);
    }

    function unstake() external {
        require(stakes[msg.sender].amount > 0, "Nothing staked");
        _claimReward(msg.sender);

        uint256 stakedAmount = stakes[msg.sender].amount;
        stakes[msg.sender] = StakeInfo({ amount: 0, startTime: 0 });
        _transfer(address(this), msg.sender, stakedAmount);

        emit TokensUnstaked(msg.sender, stakedAmount, 0);
    }

    function claimReward() external {
        require(stakes[msg.sender].amount > 0, "Nothing staked");
        _claimReward(msg.sender);
        stakes[msg.sender].startTime = block.timestamp;
    }

    function _claimReward(address user) internal {
        StakeInfo storage info = stakes[user];
        uint256 duration = block.timestamp - info.startTime;
        uint256 reward = (info.amount * STAKING_APR * duration) / (365 days * 10000);

        if (reward > 0 && totalSupply() + reward <= MAX_SUPPLY) {
            _mint(user, reward);
        }
    }

    function mintForRewards(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        treasuryWallet = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
