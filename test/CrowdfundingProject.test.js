const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers } = require("hardhat")
const { networkConfig } = require("../helper.hardhat.config")
const { parse } = require("typechain")

describe("CrowdfundingProject", async function () {
    let deployer,
        interestRateInPercent,
        projectOwner,
        funder1,
        funder2,
        funder3,
        crowfundingAmountNeeded,
        minInvestment,
        maxInvestment,
        deadlineInDays,
        investmentPeriodInDays,
        initialFees,
        iCrowdfundingProject,
        projectAddress
    const chainId = network.config.chainId

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        projectOwner = accounts[1]
        funder1 = accounts[2]
        funder2 = accounts[3]
        funder3 = accounts[4]
        interestRateInPercent = "10"
        crowfundingAmountNeeded = ethers.parseEther("38")
        minInvestment = ethers.parseEther("1")
        maxInvestment = ethers.parseEther("15")
        deadlineInDays = "5"
        investmentPeriodInDays = "60"
        await deployments.fixture(["all"])
        crowdfunding = await ethers.getContract("Crowdfunding", deployer)
        initialFees = await crowdfunding.getInitialFees(crowfundingAmountNeeded)
        // create a new project
        initialFees = await crowdfunding.getInitialFees(crowfundingAmountNeeded)
        await crowdfunding
            .connect(projectOwner)
            .createProject(
                crowfundingAmountNeeded,
                interestRateInPercent,
                minInvestment,
                maxInvestment,
                deadlineInDays,
                investmentPeriodInDays,
                {
                    value: initialFees,
                }
            )
        projectAddress = await crowdfunding.getProjectAddress(0)
        iCrowdfundingProject = await ethers.getContractAt(
            "ICrowdfundingProject",
            projectAddress,
            deployer
        )
    })
    describe("Function: fund", function () {
        it("Should fund the project with sent value", async function () {})
    })
    describe("Function: cancelProject", function () {})
    describe("Function: calculateAmountToBePaidToInvestor", function () {
        it("Should calculate how much will be investros paid after the project is finished", async function () {
            // check if the calculated value is correct
            assert.equal(
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("15"),
                    interestRateInPercent
                ),
                (15000000000000000000n * BigInt(interestRateInPercent)) / BigInt(100) +
                    15000000000000000000n
            )
        })
    })
    describe("Function: getCrowdfundingContractAddress", function () {
        it("Should get the crowdfunding contract address", async function () {
            // check if the address is correct
            assert.equal(
                await iCrowdfundingProject.getCrowdfundingContractAddress(),
                crowdfunding.target
            )
        })
    })
    describe("Function: calculateFullAmountToBePaidOutToInvestorsWithoutGasFees", function () {
        it("Should calculate how much should be paid to investor after the project is finished #1 with multiple investors", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: minInvestment,
            })
            await crowdfunding.connect(funder3).fundProject(0, {
                value: maxInvestment,
            })
            // check if the calculated value is correct
            const amountToBePaidOutMax =
                (BigInt(maxInvestment) * BigInt(interestRateInPercent)) / 100n +
                BigInt(maxInvestment)
            const amountToBePaidOutMin =
                (BigInt(minInvestment) * BigInt(interestRateInPercent)) / 100n +
                BigInt(minInvestment)
            assert.equal(
                await iCrowdfundingProject.calculateFullAmountToBePaidOutToInvestorsWithoutGasFees(),
                amountToBePaidOutMax + amountToBePaidOutMin + amountToBePaidOutMax
            )
        })
        it("Should calculate how much should be paid to investor after the project is finished #1 with the same investor multiple times", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: minInvestment,
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            // check if the calculated value is correct
            const amountToBePaidOutMax =
                (BigInt(maxInvestment) * BigInt(interestRateInPercent)) / 100n +
                BigInt(maxInvestment)
            const amountToBePaidOutMin =
                (BigInt(minInvestment) * BigInt(interestRateInPercent)) / 100n +
                BigInt(minInvestment)
            assert.equal(
                await iCrowdfundingProject.calculateFullAmountToBePaidOutToInvestorsWithoutGasFees(),
                amountToBePaidOutMax + amountToBePaidOutMin + amountToBePaidOutMax
            )
        })
    })
    describe("Function: performUpkeep", function () {
        it("Should revert if upkeep is not needed", async function () {
            // check if performUpkeep is reverted before funding the project
            // await iCrowdfundingProject.performUpkeep(`0x`)
            await expect(iCrowdfundingProject.performUpkeep(`0x`)).to.be.reverted
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            // check if performUpkeep is reverted after funding the project
            // await iCrowdfundingProject.performUpkeep(`0x`)
            await expect(iCrowdfundingProject.performUpkeep(`0x`)).to.be.reverted
            // fund the project with the rest amount neeeded
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder3).fundProject(0, {
                value: ethers.parseEther("8"),
            })
            // check if performUpkeep is reverted after funding the project with the rest amount needed
            // await iCrowdfundingProject.performUpkeep(`0x`)
            await expect(iCrowdfundingProject.performUpkeep(`0x`)).to.be.reverted
        })
        it("If the project didnt recieve enough eth until the given time, project should be CLOSED and ivnestors and owner should be paid back", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder3).fundProject(0, {
                value: ethers.parseEther("7"),
            })
            // check the project status
            const projectStatus = await iCrowdfundingProject.getProjectStatus()
            assert.equal(projectStatus, "1")
            // get balances of the investors and project owner before performUpkeep
            const balanceOfOwnerBeforeUpkeep = await ethers.provider.getBalance(
                projectOwner.address
            )
            const balanceOfInvestor1BeforeUpkeep = await ethers.provider.getBalance(funder1.address)
            const balanceOfInvestor2BeforeUpkeep = await ethers.provider.getBalance(funder2.address)
            const balanceOfInvestor3BeforeUpkeep = await ethers.provider.getBalance(funder3.address)
            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [6 * 86400])
            await network.provider.send("evm_mine", [])
            const connectedOwner = await iCrowdfundingProject.connect(projectOwner)
            const upkeepTx = await connectedOwner.performUpkeep(`0x`)
            const upkeepReceipt = await upkeepTx.wait(1)
            const { gasUsed, gasPrice } = upkeepReceipt
            const gasCost = BigInt(gasPrice) * BigInt(gasUsed)
            // get balances of the investors and project owner after performUpkeep
            const balanceOfOwnerAfterUpkeep = await ethers.provider.getBalance(projectOwner.address)
            const balanceOfInvestor1AfterUpkeep = await ethers.provider.getBalance(funder1.address)
            const balanceOfInvestor2AfterUpkeep = await ethers.provider.getBalance(funder2.address)
            const balanceOfInvestor3AfterUpkeep = await ethers.provider.getBalance(funder3.address)
            // check if the funders are paid back
            assert.equal(
                balanceOfInvestor1AfterUpkeep,
                balanceOfInvestor1BeforeUpkeep + maxInvestment
            )
            assert.equal(
                balanceOfInvestor2AfterUpkeep,
                balanceOfInvestor2BeforeUpkeep + maxInvestment
            )
            assert.equal(
                balanceOfInvestor3AfterUpkeep,
                balanceOfInvestor3BeforeUpkeep + ethers.parseEther("7")
            )
            // check if the project owner is paid back
            assert.equal(
                balanceOfOwnerAfterUpkeep,
                balanceOfOwnerBeforeUpkeep + (initialFees - gasCost)
            )
            // check if the project balance is zero and the status is closed
            assert.equal(await ethers.provider.getBalance(projectAddress), "0")
            // check if the project status changed to CLOSED = 0
            assert.equal(await iCrowdfundingProject.getProjectStatus(), "0")
        })
    })
})
