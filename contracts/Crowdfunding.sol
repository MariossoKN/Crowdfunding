// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.18;

/**
 * @title
 * @author
 * @notice
 */

import {CrowdfundingProject} from "./CrowdfundingProject.sol";

contract Crowdfunding {
    event ProjectCreated(
        address indexed _owner,
        CrowdfundingProject indexed _projectAddress,
        uint256 indexed _projectIndex
    );

    event ProjectFunded(
        address indexed _funder,
        uint256 indexed _projectIndex,
        uint256 _fundAmount
    );

    error Crowdfunding__YouAreNotAllowedToCancelThisProject();
    error Crowdfunding__YouHaveToSendTheExactAmountForInitialFees(uint256);
    error Crowdfunding__CanBeCalledOnlyByOwner();
    error Crowdfunding__CanBeCalledOnlyByProjectOwner();
    error Crowdfunding__NotEnoughEthInTheProjectContract();
    error Crowdfunding__ValueSentCantBeZero();

    CrowdfundingProject[] private s_crowdfundingProjectArray;

    uint256 private immutable i_crowfundFeeInPercent;
    uint256 private immutable i_minDeadlineInDays;
    address private immutable i_owner;

    constructor(uint256 _crowfundFeeInPrecent, uint256 _minDeadlineInDays) {
        i_crowfundFeeInPercent = _crowfundFeeInPrecent;
        i_minDeadlineInDays = _minDeadlineInDays;
        i_owner = payable(msg.sender);
    }

    // lets the project owner to create a new project; project owner has to pay the initial fees - if projects funding will be successful, fees will be sent back to this contract; if the projects funding will be canceled, the initial fees will be returned to project owner
    function createProject(
        uint256 _maxCrowfundingAmount,
        uint256 _interestRateInPercent,
        uint256 _minInvestment,
        uint256 _maxInvestment,
        uint256 _deadlineInDays,
        uint256 _investmentPeriodDays
    ) external payable {
        uint256 initialFees = calculateInitialFee(_maxCrowfundingAmount);
        if (msg.value != initialFees) {
            revert Crowdfunding__YouHaveToSendTheExactAmountForInitialFees(initialFees);
        }
        CrowdfundingProject crowdfundingProject = new CrowdfundingProject{value: msg.value}(
            payable(msg.sender),
            _maxCrowfundingAmount,
            _interestRateInPercent,
            _minInvestment,
            _maxInvestment,
            _deadlineInDays,
            _investmentPeriodDays,
            i_minDeadlineInDays,
            payable(address(this))
        );
        s_crowdfundingProjectArray.push(crowdfundingProject);
        emit ProjectCreated(msg.sender, crowdfundingProject, s_crowdfundingProjectArray.length - 1);
    }

    // lets the investor to fund the project, the investment cant be less than the minInvestment and more than the maxInvestment
    function fundProject(uint256 _projectId) external payable {
        s_crowdfundingProjectArray[_projectId].fund{value: msg.value}(msg.sender);
        emit ProjectFunded(msg.sender, _projectId, msg.value);
    }

    // lets the project owner to cancel the project; investors will get their investment back and the project owner will get the back the initial fees - gas fees
    function cancelProject(uint256 _projectId) external {
        address owner = s_crowdfundingProjectArray[_projectId].getOwner();
        if (msg.sender != owner) {
            revert Crowdfunding__YouAreNotAllowedToCancelThisProject();
        }
        s_crowdfundingProjectArray[_projectId].cancel();
    }

    // lets the project owner to fund the project contract to be able to pay out the investors (cant forget the gas fees to sent eth to investors), the rest eth will be sent back with the same transaction
    function ownerFundProject(uint256 _projectId) external payable {
        if (msg.sender != s_crowdfundingProjectArray[_projectId].getOwner()) {
            revert Crowdfunding__CanBeCalledOnlyByProjectOwner();
        }
        if (msg.value == 0) {
            revert Crowdfunding__ValueSentCantBeZero();
        }
        s_crowdfundingProjectArray[_projectId].ownerFund{value: msg.value}();
    }

    // ??? add a function to pay out a single investor ??? just in case the finish function doest work properly

    // lets the project owner to finish the project and pay out the investors; proejct owner has to first fund the project with the ownerFundProject function
    function finishProject(uint256 _projectId) external {
        if (msg.sender != s_crowdfundingProjectArray[_projectId].getOwner()) {
            revert Crowdfunding__CanBeCalledOnlyByProjectOwner();
        }
        if (
            getFullAmountToBePaidOutToInvestorsWithoutGasFees(_projectId) >=
            address(s_crowdfundingProjectArray[_projectId]).balance
        ) {
            revert Crowdfunding__NotEnoughEthInTheProjectContract();
        }
        s_crowdfundingProjectArray[_projectId].finish();
    }

    // lets the crowdfunding owner to withdraw the fees paid by project owner
    function withdrawFees() external {
        if (msg.sender != i_owner) {
            revert Crowdfunding__CanBeCalledOnlyByOwner();
        }
        (bool success, ) = (i_owner).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    // calculates the initial fees paid by project owner
    function calculateInitialFee(uint256 _maxCrowdfundingAmount) internal view returns (uint256) {
        uint256 initialFees = (_maxCrowdfundingAmount * i_crowfundFeeInPercent) / 100;
        return initialFees;
    }

    //////////////////////
    // Getter Functions //
    //////////////////////

    function getProjectAddress(uint256 _projectId) public view returns (CrowdfundingProject) {
        return s_crowdfundingProjectArray[_projectId];
    }

    function getInitialFees(uint256 _maxCrowdfundingAmount) public view returns (uint256) {
        return calculateInitialFee(_maxCrowdfundingAmount);
    }

    function getCrowdfundingFeeInPercent() public view returns (uint256) {
        return i_crowfundFeeInPercent;
    }

    function getMinDeadlineInDays() public view returns (uint256) {
        return i_minDeadlineInDays;
    }

    function getProjectsCount() public view returns (uint256) {
        return s_crowdfundingProjectArray.length;
    }

    function getProjectStatus(
        uint256 _projectId
    ) public view returns (CrowdfundingProject.ProjectState) {
        return s_crowdfundingProjectArray[_projectId].getProjectStatus();
    }

    function getProjectAmountFunded(uint256 _projectId) public view returns (uint256) {
        return s_crowdfundingProjectArray[_projectId].getProjectFundedAmount();
    }

    function getFullAmountToBePaidOutToInvestorsWithoutGasFees(
        uint256 _projectId
    ) public view returns (uint256) {
        return
            s_crowdfundingProjectArray[_projectId]
                .calculateFullAmountToBePaidOutToInvestorsWithoutGasFees();
    }

    fallback() external {}

    receive() external payable {}
}
