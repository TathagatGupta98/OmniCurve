// use alloy_sol_types::sol;
use stylus_sdk::prelude::*;
use alloc::vec;

sol_interface! {
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }

    interface IProxyAmm {
        function initialize(address owner) external;
        function setUsdcToken(address token) external;
        function setSigmaMin(int256 min) external;
        function setRouterAddress(address addr) external;
        function setLpToken(address lp_token) external;
        function transferOwnership(address new_owner) external;
        function acceptOwnership() external;
        function lpToken() external view returns (address);
    }

    interface IProxyRouter {
        function initialize(address owner) external;
        function setUsdcToken(address token) external;
        function setAmmAddress(address addr) external;
        function transferOwnership(address new_owner) external;
        function acceptOwnership() external;
    }

    interface ILpToken {
        function initialize(address owner, string calldata name, string calldata symbol) external;
        function transferOwnership(address new_owner) external;
        function acceptOwnership() external;
        function name() external view returns (string memory);
        function symbol() external view returns (string memory);
        function decimals() external view returns (uint8);
        function totalSupply() external view returns (uint256);
        function balanceOf(address account) external view returns (uint256);
        function allowance(address owner, address spender) external view returns (uint256);
        function transfer(address to, uint256 amount) external returns (bool);
        function approve(address spender, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function mint(address to, uint256 amount) external;
        function burn(address from, uint256 amount) external;
    }
}

