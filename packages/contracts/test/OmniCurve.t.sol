// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

interface IBinaryRouter {
    function buyYes(int256 target_price, uint256 amount_wad) external;
    function buyNo(int256 target_price, uint256 amount_wad) external;
    function claimWinnings(bool is_yes, uint256 amount_wad) external;
    function setAmmAddress(address addr) external;
    function getBalance(address user, uint256 token_id) external view returns (uint256);
}

interface IDistributionAmm {
    function globalMu() external view returns (int256);
    function globalSigma() external view returns (int256);
    function addLiquidity(uint256 amount_wad, int256 target_mu, int256 target_sigma) external;
    function removeLiquidity(uint256 shares_to_remove) external;
    function getPriceForX(int256 x, bool is_yes) external view returns (int256);
}

contract MockDistributionAmm is IDistributionAmm {
    int256 public globalMu = 0;
    int256 public globalSigma = 1e18; // WAD 1.0
    int256 public sigmaMin = 1e16;    // 0.01

    error VarianceTooLow();

    function addLiquidity(uint256 /*amount_wad*/, int256 target_mu, int256 target_sigma) external {
        if (target_sigma <= sigmaMin) {
            revert VarianceTooLow();
        }
        
        // Mock state updates for test
        globalMu = target_mu;
        globalSigma = target_sigma;
    }

    function removeLiquidity(uint256 /*shares_to_remove*/) external {}

    function getPriceForX(int256 /*x*/, bool /*is_yes*/) external pure returns (int256) {
        return 50 * 1e16; // 0.5 WAD mock price
    }
}

contract MockBinaryRouter is IBinaryRouter {
    address public ammAddress;

    function setAmmAddress(address addr) external {
        ammAddress = addr;
    }

    function buyYes(int256 /*target_price*/, uint256 /*amount_wad*/) external {}
    function buyNo(int256 /*target_price*/, uint256 /*amount_wad*/) external {}
    function claimWinnings(bool /*is_yes*/, uint256 /*amount_wad*/) external {}
    
    function getBalance(address /*user*/, uint256 /*token_id*/) external pure returns (uint256) {
        return 0;
    }
}

contract OmniCurveTest is Test {
    MockDistributionAmm amm;
    MockBinaryRouter router;

    function setUp() public {
        amm = new MockDistributionAmm();
        router = new MockBinaryRouter();
        router.setAmmAddress(address(amm));
    }

    function test_RevertIf_VarianceTooLow() public {
        vm.expectRevert(MockDistributionAmm.VarianceTooLow.selector);
        amm.addLiquidity(1e18, 0, 1e15); // sigma (0.001) <= sigmaMin (0.01)
    }

    function test_StateUpdateOnTrade() public {
        int256 targetMu = 1e18;
        int256 targetSigma = 2e18;

        amm.addLiquidity(1e18, targetMu, targetSigma);

        int256 newMu = amm.globalMu();
        int256 newSigma = amm.globalSigma();

        assertEq(newMu, targetMu);
        assertEq(newSigma, targetSigma);
    }
}
