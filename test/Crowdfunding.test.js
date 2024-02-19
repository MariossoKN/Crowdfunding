const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { networkConfig } = require("../helper.hardhat.config")
const { parse } = require("typechain")
const { assertArgument } = require("ethers")

describe("Crowdfunding", async function () {
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
        initialFees
    const chainId = network.config.chainId

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        projectOwner = accounts[1]
        funder1 = accounts[2]
        funder2 = accounts[3]
        funder3 = accounts[4]
        interestRateInPercent = "10"
        crowfundingAmountNeeded = ethers.parseEther("40")
        minInvestment = ethers.parseEther("1")
        maxInvestment = ethers.parseEther("15")
        deadlineInDays = "30"
        investmentPeriodInDays = "60"
        await deployments.fixture(["all"])
        crowdfunding = await ethers.getContract("Crowdfunding", deployer)
        initialFees = await crowdfunding.getInitialFees(crowfundingAmountNeeded)
    })
    describe("Function: constructor", function () {
        it("Sets the crowdfunding fee correctly", async function () {
            assert.equal(
                await crowdfunding.getCrowdfundingFeeInPercent(),
                networkConfig[chainId]["crowfundFeeInPrecent"]
            )
        })
        it("Sets the minimum deadline in days correctly", async function () {
            assert.equal(
                await crowdfunding.getMinDeadlineInDays(),
                networkConfig[chainId]["crowfundMinDeadlineInDays"]
            )
        })
    })
    describe("Function: createProject", function () {
        it("Should revert if the value sent is not equal to initial fees of the project #1 not enough ETH sent", async function () {
            // console.log(
            //     `Initial crowfunding fee in % is: ${await crowdfunding.getCrowdfundingFeeInPercent()}`
            // )
            // console.log(`InitialFees paid by project owner: ${initialFees}`)
            const initialFeesNotEnough = "240000000000000000"
            await expect(
                crowdfunding
                    .connect(projectOwner)
                    .createProject(
                        crowfundingAmountNeeded,
                        interestRateInPercent,
                        minInvestment,
                        maxInvestment,
                        deadlineInDays,
                        investmentPeriodInDays,
                        {
                            value: initialFeesNotEnough,
                        }
                    )
            )
                .to.be.revertedWithCustomError(
                    crowdfunding,
                    "Crowdfunding__YouHaveToSendTheExactAmountForInitialFees"
                )
                .withArgs(initialFees)
        })
        it("Should revert if the value sent is not equal to initial fees of the project #2 too much ETH sent", async function () {
            const initialFeesTooMuch = "24000000000000000000"
            await expect(
                crowdfunding
                    .connect(projectOwner)
                    .createProject(
                        crowfundingAmountNeeded,
                        interestRateInPercent,
                        minInvestment,
                        maxInvestment,
                        deadlineInDays,
                        investmentPeriodInDays,
                        {
                            value: initialFeesTooMuch,
                        }
                    )
            )
                .to.be.revertedWithCustomError(
                    crowdfunding,
                    "Crowdfunding__YouHaveToSendTheExactAmountForInitialFees"
                )
                .withArgs(initialFees)
        })
        it("Should send initial fees to the new crowdfunding project", async function () {
            assert.equal(await crowdfunding.getProjectsCount(), "0")
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
            // get the project address
            const projectAddress = await crowdfunding.getProjectAddress(0)

            // checks if the balance of the project contract is equal to the initial fees sent with the createProject transaction
            assert.equal(await ethers.provider.getBalance(projectAddress), initialFees)
        })
        it("Should revert if the max crowfunding amount is less then the maximum investment", async function () {
            const crowfundingAmountNeededLessThenMax = ethers.parseEther("14")
            await expect(
                crowdfunding
                    .connect(projectOwner)
                    .createProject(
                        crowfundingAmountNeededLessThenMax,
                        interestRateInPercent,
                        minInvestment,
                        maxInvestment,
                        deadlineInDays,
                        investmentPeriodInDays,
                        {
                            value: initialFees,
                        }
                    )
            ).to.be.reverted
        })
        it("Should revert if the minimum investment is greater than the maximum investment", async function () {
            const minInvestmentGreaterThanMax = ethers.parseEther("16")
            await expect(
                crowdfunding
                    .connect(projectOwner)
                    .createProject(
                        crowfundingAmountNeeded,
                        interestRateInPercent,
                        minInvestmentGreaterThanMax,
                        maxInvestment,
                        deadlineInDays,
                        investmentPeriodInDays,
                        {
                            value: initialFees,
                        }
                    )
            ).to.be.reverted
        })
        it("Should should revert if value of deadline in days is less the the minimum", async function () {
            const deadlineInDaysLessThanMin = "1"
            await expect(
                crowdfunding
                    .connect(projectOwner)
                    .createProject(
                        crowfundingAmountNeeded,
                        interestRateInPercent,
                        minInvestment,
                        maxInvestment,
                        deadlineInDaysLessThanMin,
                        investmentPeriodInDays,
                        {
                            value: initialFees,
                        }
                    )
            ).to.be.reverted
        })
        it("Creates a new crowdfunding project with the correct values", async function () {
            assert.equal(await crowdfunding.getProjectsCount(), "0")
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
            // check if there is a new project in project array
            assert.equal(await crowdfunding.getProjectsCount(), "1")
            const projectAddress = await crowdfunding.getProjectAddress(0)
            // get the instance of the CrowdfundingProject contract
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            // checks if the balance of the project contract is equal to the crowfundingAmountNeeded
            assert.equal(await ethers.provider.getBalance(projectAddress), initialFees)
            // check if the deployer is the owner
            const owner = await iCrowdfundingProject.getOwner()
            assert.equal(owner, projectOwner.address)
            // check if the maxCrowdfundingAmount is equal to the crowfundingAmountNeeded
            assert.equal(
                await iCrowdfundingProject.getProjectMaxCrowdfundingAmount(),
                crowfundingAmountNeeded
            )
            // check if the current funded amount is zero
            assert.equal(await iCrowdfundingProject.getProjectFundedAmount(), "0")
            // check if the interest rate is equal to the interestRateInPercent
            assert.equal(
                await iCrowdfundingProject.getProjectInterestRateInPercent(),
                interestRateInPercent
            )
            // check if the min investment is equal to the minInvestment
            assert.equal(await iCrowdfundingProject.getProjectMinInvestment(), minInvestment)
            // check if the max investment is equal to the maxInvestment
            assert.equal(await iCrowdfundingProject.getProjectMaxInvestment(), maxInvestment)
            // check if the deadline is equal to the deadlineInDays
            assert.equal(await iCrowdfundingProject.getProjectDeadlineInDays(), deadlineInDays)
            // check if the investment period is equal to the investmentPeriodInDays
            assert.equal(
                await iCrowdfundingProject.getProjectInvestmentPeriod(),
                investmentPeriodInDays
            )
            // check if the project status is 1 which is FUNDING_ACTIVE
            assert.equal(await iCrowdfundingProject.getProjectStatus(), "1")
            // check if the project start timestamp is equal to the current block timestamp
            const currentBlockTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
            assert.equal(
                await iCrowdfundingProject.getProjectStartTimestamp(),
                currentBlockTimeStamp
            )
            // check if the investors count is equal to zero
            assert.equal(await iCrowdfundingProject.getInvestorsCount(), "0")
        })
        it("Should add the new project address to project address array #1 one project", async function () {
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
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            assert.equal(iCrowdfundingProject.target, projectAddress)
        })
        it("Should add the new project address to project address array #2 multiple projects", async function () {
            // project 1
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
            const project1Address = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject1 = await ethers.getContractAt(
                "ICrowdfundingProject",
                project1Address,
                deployer
            )
            assert.equal(iCrowdfundingProject1.target, project1Address)
            // console.log(`Project 1 address: ${project1Address}`)
            // project 2
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
            const project2Address = await crowdfunding.getProjectAddress(1)
            const iCrowdfundingProject2 = await ethers.getContractAt(
                "ICrowdfundingProject",
                project2Address,
                deployer
            )
            assert.equal(iCrowdfundingProject2.target, project2Address)
            // console.log(`Project 2 address: ${project2Address}`)
            // project 3
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
            const project3Address = await crowdfunding.getProjectAddress(2)
            const iCrowdfundingProject3 = await ethers.getContractAt(
                "ICrowdfundingProject",
                project3Address,
                deployer
            )
            assert.equal(iCrowdfundingProject3.target, project3Address)
            // console.log(`Project 3 address: ${project3Address}`)
        })
    })
    describe("Function: fundProject", function () {
        it("Should revert if called directly and not by the Crowdfunding contract", async function () {
            // create a new project
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
            // get the project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            await expect(
                iCrowdfundingProject.fund(funder1.address, {
                    value: minInvestment,
                })
            ).to.be.reverted
        })
        it("Should revert if project is not active", async function () {
            // create a new project
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
            // cancel the project
            await crowdfunding.connect(projectOwner).cancelProject(0)
            await expect(crowdfunding.fundProject(0, { value: minInvestment })).to.be.reverted
        })
        it("Should revert if the funded value is less then the minimum investment", async function () {
            // create a new project
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
            // await crowdfunding.connect(funder1).fundProject(0, {
            //     value: ethers.parseEther("0.9"),
            // })
            await expect(
                crowdfunding.connect(funder1).fundProject(0, {
                    value: ethers.parseEther("0.9"),
                })
            ).to.be.reverted
        })
        it("Should revert if the funded value is more then the maximum investment", async function () {
            // create a new project
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
            // call the fundProject function with wrong input
            // await crowdfunding.connect(funder1).fundProject(0, {
            //     value: ethers.parseEther("15.1"),
            // })
            await expect(
                crowdfunding.connect(funder1).fundProject(0, {
                    value: ethers.parseEther("15.1"),
                })
            ).to.be.reverted
        })
        it("Should fund the project with sent value", async function () {
            // create a new project
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
            // get the project address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            // get the project balance before fund
            const balanceOfProjectBeforeFund = await ethers.provider.getBalance(projectAddress)
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: minInvestment,
            })
            // get the project balance after fund
            const balanceOfProjectAfterFund = await ethers.provider.getBalance(projectAddress)
            assert.equal(balanceOfProjectAfterFund, balanceOfProjectBeforeFund + minInvestment)
        })
        it("Should revert if the funded value is more then the rest needed crowdfunding amount", async function () {
            // create a new project
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
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            // fund the project with more eth then is needed to finish the project
            // await crowdfunding.connect(funder3).fundProject(0, {
            //     value: ethers.parseEther("11"),
            // })
            await expect(
                crowdfunding.connect(funder3).fundProject(0, {
                    value: ethers.parseEther("11"),
                })
            ).to.be.reverted
        })
        it("Should update the investor array with correct values #1 with different funders", async function () {
            // create the project
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
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder3).fundProject(0, {
                value: ethers.parseEther("8"),
            })
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            // check if the address is correct
            assert.equal(await iCrowdfundingProject.getInvestorAddress(0), funder1.address)
            assert.equal(await iCrowdfundingProject.getInvestorAddress(1), funder2.address)
            assert.equal(await iCrowdfundingProject.getInvestorAddress(2), funder3.address)
            // check if the invested amount is correct
            assert.equal(
                await iCrowdfundingProject.getInvestorsInvestmentAmount(0),
                ethers.parseEther("15")
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsInvestmentAmount(1),
                ethers.parseEther("15")
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsInvestmentAmount(2),
                ethers.parseEther("8")
            )
            // check if the amount to be paid out is correct
            assert.equal(
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(0),
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("15"),
                    interestRateInPercent
                )
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(1),
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("15"),
                    interestRateInPercent
                )
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(2),
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("8"),
                    interestRateInPercent
                )
            )
            // check if the status "paidOut" is set to false
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(0), false)
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(1), false)
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(2), false)
        })
        it("Should update the investor array with correct values #2 with the same funder", async function () {
            // create the project
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
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("8"),
            })
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            // check if the address is correct
            assert.equal(await iCrowdfundingProject.getInvestorAddress(0), funder1.address)
            assert.equal(await iCrowdfundingProject.getInvestorAddress(1), funder1.address)
            assert.equal(await iCrowdfundingProject.getInvestorAddress(2), funder1.address)
            // check if the invested amount is correct
            assert.equal(
                await iCrowdfundingProject.getInvestorsInvestmentAmount(0),
                ethers.parseEther("15")
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsInvestmentAmount(1),
                ethers.parseEther("15")
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsInvestmentAmount(2),
                ethers.parseEther("8")
            )
            // check if the amount to be paid out is correct
            assert.equal(
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(0),
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("15"),
                    interestRateInPercent
                )
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(1),
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("15"),
                    interestRateInPercent
                )
            )
            assert.equal(
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(2),
                await iCrowdfundingProject.calculateAmountToBePaidToInvestor(
                    ethers.parseEther("8"),
                    interestRateInPercent
                )
            )
            // check if the status "paidOut" is set to false
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(0), false)
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(1), false)
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(2), false)
        })
        it("Should update the crowdFunded value correctly #1 with different funders", async function () {
            // create the project
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
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder3).fundProject(0, {
                value: ethers.parseEther("8"),
            })
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            // check the crowdFunded value is calculated correctly
            const contractBalance = await ethers.provider.getBalance(projectAddress)
            assert.equal(
                await iCrowdfundingProject.getProjectFundedAmount(),
                BigInt(contractBalance) - BigInt(initialFees)
            )
        })
        it("Should update the crowdFunded value correctly #2 with the same funder", async function () {
            // create the project
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
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("15"),
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: ethers.parseEther("8"),
            })
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            // check the crowdFunded value is calculated correctly
            const contractBalance = await ethers.provider.getBalance(projectAddress)
            assert.equal(
                await iCrowdfundingProject.getProjectFundedAmount(),
                BigInt(contractBalance) - BigInt(initialFees)
            )
        })
    })
    describe("Function: ownerFundProject", function () {
        it("Should revert if not called by owner", async function () {
            // create a new project
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
            // call the owner fund function as not owner
            await expect(
                crowdfunding.connect(funder1).ownerFundProject("0", { value: minInvestment })
            ).to.be.revertedWithCustomError(
                crowdfunding,
                "Crowdfunding__CanBeCalledOnlyByProjectOwner"
            )
        })
        it("Should revert if value sent is zero", async function () {
            // create a new project
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
            // call the owner fund function with zero eth
            await expect(
                crowdfunding.connect(projectOwner).ownerFundProject("0", { value: "0" })
            ).to.be.revertedWithCustomError(crowdfunding, "Crowdfunding__ValueSentCantBeZero")
        })
        it("Should revert if the project is not in INVESTING_ACTIVE state", async function () {
            // create the project
            await crowdfunding
                .connect(projectOwner)
                .createProject(
                    ethers.parseEther("30"),
                    interestRateInPercent,
                    minInvestment,
                    maxInvestment,
                    "2",
                    investmentPeriodInDays,
                    {
                        value: ethers.parseEther("0.6"),
                    }
                )
            // fund the project
            await crowdfunding.connect(funder1).fundProject("0", { value: maxInvestment })
            await crowdfunding.connect(funder2).fundProject("0", { value: maxInvestment })
            // owner fund the project
            const amountFundedByOwner = 34000000000000000000n
            // await crowdfunding.connect(projectOwner).ownerFundProject("0", {
            //     value: amountFundedByOwner,
            // })
            await expect(
                crowdfunding
                    .connect(projectOwner)
                    .ownerFundProject("0", { value: amountFundedByOwner })
            ).to.be.reverted
        })
        it("Should fund the project contract with the sent value", async function () {
            // create the project
            await crowdfunding
                .connect(projectOwner)
                .createProject(
                    ethers.parseEther("30"),
                    interestRateInPercent,
                    minInvestment,
                    maxInvestment,
                    "2",
                    investmentPeriodInDays,
                    {
                        value: ethers.parseEther("0.6"),
                    }
                )
            // fund the project
            await crowdfunding.connect(funder1).fundProject("0", { value: maxInvestment })
            await crowdfunding.connect(funder2).fundProject("0", { value: maxInvestment })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // get balances before
            const projectBalanceBefore = await ethers.provider.getBalance(projectAddress)
            // console.log(`Project balance before: ${projectBalanceBefore}`)

            // owner fund the project
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding
                .connect(projectOwner)
                .ownerFundProject("0", { value: amountFundedByOwner })

            // get balance after
            const projectBalanceAfter = await ethers.provider.getBalance(projectAddress)

            // assert
            assert.equal(projectBalanceAfter, projectBalanceBefore + amountFundedByOwner)
        })
    })
    describe("Function: cancelProject", function () {
        beforeEach(async () => {
            // create the project
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
        })
        it("Should revert if called by not the project owner #1 without a funder", async function () {
            await expect(
                crowdfunding.connect(funder1).cancelProject(0)
            ).to.be.revertedWithCustomError(
                crowdfunding,
                "Crowdfunding__YouAreNotAllowedToCancelThisProject"
            )
        })
        it("Should revert if called by not the project owner #2 with a funder", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: minInvestment,
            })
            await expect(
                crowdfunding.connect(funder1).cancelProject(0)
            ).to.be.revertedWithCustomError(
                crowdfunding,
                "Crowdfunding__YouAreNotAllowedToCancelThisProject"
            )
        })
        it("Should set the status of the project to cancel #1 without funder", async function () {
            // 1 = FUNDING_ACTIVE
            assert.equal(await crowdfunding.getProjectStatus(0), "1")
            // cancel the project
            await crowdfunding.connect(projectOwner).cancelProject(0)
            // 4 = CANCELED
            assert.equal(await crowdfunding.getProjectStatus(0), "4")
        })
        it("Should set the status of the project to cancel #2 with funder", async function () {
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )
            // fund the project
            await crowdfunding.fundProject(0, {
                value: minInvestment,
            })
            // console.log(`Investors address: ${await iCrowdfundingProject.getInvestorAddress(0)}`)
            assert.equal(await iCrowdfundingProject.getInvestorAddress(0), deployer.address)
            // 1 = FUNDING_ACTIVE
            assert.equal(await crowdfunding.getProjectStatus(0), "1")
            await crowdfunding.connect(projectOwner).cancelProject(0)
            // 4 = CANCELED
            assert.equal(await crowdfunding.getProjectStatus(0), "4")
        })
        it("Should pay back investor #1 with one investor", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            // get the funders balances before cancel
            const funderBalanceBefore = await ethers.provider.getBalance(funder1.address)
            // cancel the project
            await crowdfunding.connect(projectOwner).cancelProject(0)
            // get funders balance after cancel
            const funderBalanceAfter = await ethers.provider.getBalance(funder1.address)
            assert.equal(BigInt(funderBalanceAfter), BigInt(funderBalanceBefore) + maxInvestment)
        })
        it("Should pay back investors #2 with multiple investors", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })
            // get the funders balances before cancel
            const funder1BalanceBefore = await ethers.provider.getBalance(funder1.address)
            const funder2BalanceBefore = await ethers.provider.getBalance(funder2.address)
            // cancel the project
            await crowdfunding.connect(projectOwner).cancelProject(0)
            // get funders balance after cancel
            const funder1BalanceAfter = await ethers.provider.getBalance(funder1.address)
            const funder2BalanceAfter = await ethers.provider.getBalance(funder2.address)

            assert.equal(BigInt(funder1BalanceAfter), BigInt(funder1BalanceBefore) + maxInvestment)
            assert.equal(BigInt(funder2BalanceAfter), BigInt(funder2BalanceBefore) + maxInvestment)
        })
        it("Should pay back investors #3 with multiple funds from the same investor", async function () {
            // fund the project with the same funder
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: minInvestment,
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: minInvestment,
            })
            // get the balance of the funder before cancel
            const funderBalanceBeforeCancel = await ethers.provider.getBalance(funder1.address)
            // cancel the project
            await crowdfunding.connect(projectOwner).cancelProject(0)
            // get the balance of the funder after cancel
            const funderBalanceAfterCancel = await ethers.provider.getBalance(funder1.address)
            // check if the balance after cancel is the same as balance before cancel + the investment amount
            assert.equal(
                BigInt(funderBalanceAfterCancel),
                BigInt(funderBalanceBeforeCancel) +
                    BigInt(maxInvestment) +
                    BigInt(minInvestment) +
                    BigInt(minInvestment)
            )
        })
        it("Should reset the investors array", async function () {
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress
            )
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: minInvestment,
            })
            assert.equal(await iCrowdfundingProject.getInvestorsCount(), "2")
            // cancel the project
            await crowdfunding.connect(projectOwner).cancelProject(0)
            assert.equal(await iCrowdfundingProject.getInvestorsCount(), "0")
        })
        it("Should send the rest of ETH back to owner (initial fees - gas fees) #1 with one funder", async function () {
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress
            )
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            const funder1InvestmentAmount = await iCrowdfundingProject.getInvestorsInvestmentAmount(
                0
            )
            // get the balances before cancel
            const projectBalanceBefore = await ethers.provider.getBalance(projectAddress)
            // console.log(`Project balance before: ${projectBalanceBefore}`)
            const ownerBalanceBefore = await ethers.provider.getBalance(projectOwner.address)
            // console.log(`Owner balance before: ${ownerBalanceBefore}`)
            // cancel the project and calculate gas cost
            const ownerConnected = await crowdfunding.connect(projectOwner)
            const cancelTx = await ownerConnected.cancelProject(0)
            const cancelReceipt = await cancelTx.wait()
            const gasUsed = cancelReceipt.gasUsed
            const gasPrice = cancelReceipt.gasPrice
            const cancelTxGas = BigInt(gasPrice) * BigInt(gasUsed)
            // get the balances after
            // console.log(`Fund: gas used: ${cancelTxGas}`)
            const projectBalanceAfter = await ethers.provider.getBalance(projectAddress)
            // console.log(`Project balance after: ${projectBalanceAfter}`)
            const ownerBalanceAfter = await ethers.provider.getBalance(projectOwner.address)
            // console.log(`Owner balance after: ${ownerBalanceAfter}`)
            // console.log(`Owner balance before: ${ownerBalanceBefore}`)
            // console.log(`Funder1 investment: ${funder1InvestmentAmount}`)
            const restSentToOwner = BigInt(projectBalanceBefore) - BigInt(funder1InvestmentAmount)
            // console.log(`Rest sent to owner: ${restSentToOwner}`)
            assert.equal(
                BigInt(ownerBalanceBefore) + (restSentToOwner - cancelTxGas),
                BigInt(ownerBalanceAfter)
            )
        })
        it("Should send the rest of ETH back to owner (initial fees - gas fees) #2 with multiple funders", async function () {
            // get the project contract
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress
            )
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })
            // get the balances before cancel
            const projectBalanceBefore = await ethers.provider.getBalance(projectAddress)
            // console.log(`Project balance before: ${projectBalanceBefore}`)
            const ownerBalanceBefore = await ethers.provider.getBalance(projectOwner.address)
            // console.log(`Owner balance before: ${ownerBalanceBefore}`)
            // cancel the project and calculate the gas cost
            const ownerConnected = await crowdfunding.connect(projectOwner)
            const cancelTx = await ownerConnected.cancelProject(0)
            const cancelReceipt = await cancelTx.wait()
            const gasUsed = cancelReceipt.gasUsed.toString()
            const gasPrice = cancelReceipt.gasPrice.toString()
            const cancelTxGas = parseInt(gasPrice) * parseInt(gasUsed)
            // get the balances after
            // console.log(`Fund: gas used: ${cancelTxGas}`)
            const projectBalanceAfter = await ethers.provider.getBalance(projectAddress)
            // console.log(`Project balance after: ${projectBalanceAfter}`)
            const ownerBalanceAfter = await ethers.provider.getBalance(projectOwner.address)
            // console.log(`Owner balance after: ${ownerBalanceAfter}`)
            const restSentToOwner = BigInt(projectBalanceBefore) - (maxInvestment + maxInvestment)

            assert.equal(
                BigInt(ownerBalanceBefore) + (BigInt(restSentToOwner) - BigInt(cancelTxGas)),
                BigInt(ownerBalanceAfter)
            )
        })
    })
    describe("Function: finishProject", function () {
        beforeEach(async () => {
            // create a new project
            await crowdfunding
                .connect(projectOwner)
                .createProject(
                    ethers.parseEther("30"),
                    interestRateInPercent,
                    minInvestment,
                    maxInvestment,
                    "2",
                    investmentPeriodInDays,
                    {
                        value: ethers.parseEther("0.6"),
                    }
                )
        })
        it("Should revert if called by not the project owner", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // call finish function as the funder (not owner)
            await expect(
                crowdfunding.connect(funder1).finishProject(0)
            ).to.be.revertedWithCustomError(
                crowdfunding,
                "Crowdfunding__CanBeCalledOnlyByProjectOwner"
            )
        })
        it("Should revert if the project contract doesnt have enough eth to fully pay investors", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // call finish function as the project owner, but the project doesnt have enough eth
            await expect(
                crowdfunding.connect(projectOwner).finishProject(0)
            ).to.be.revertedWithCustomError(
                crowdfunding,
                "Crowdfunding__NotEnoughEthInTheProjectContract"
            )
        })
        it("Should revert if not called by the crowdfunding contract", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // calculate how much eth we have to pay to investors
            const fullAmoutToBePaidOut =
                await crowdfunding.getFullAmountToBePaidOutToInvestorsWithoutGasFees(0)
            // console.log(`Full amount to be paid out to ivnestors: ${fullAmoutToBePaidOut}`)

            // fund the project as project owner (amount to be paid to investors + gas fees)
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding.connect(projectOwner).ownerFundProject(0, {
                value: amountFundedByOwner,
            })

            // call finish function as the project owner
            // await iCrowdfundingProject.connect(projectOwner).finish()
            await expect(iCrowdfundingProject.connect(projectOwner).finish()).to.be.reverted
        })
        it("Should revert if the project state is not INVESTING_ACTIVE", async function () {
            // call finish function as the owner
            // await crowdfunding.connect(projectOwner).finishProject(0)
            await expect(crowdfunding.connect(projectOwner).finishProject(0)).to.be.reverted
        })
        it("Should change the project status to FINISHED", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // check the status of the project (FUNDING_ACTIVE = 1)
            assert.equal(await crowdfunding.getProjectStatus(0), "1")

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // check the status of the project (INVESTING_ACTIVE = 2)
            assert.equal(await crowdfunding.getProjectStatus(0), "2")

            // call fund and finish function as the project owner
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding.connect(projectOwner).ownerFundProject(0, {
                value: amountFundedByOwner,
            })
            await crowdfunding.connect(projectOwner).finishProject("0")

            // check the status of the project (FINISHED = 3)
            assert.equal(await crowdfunding.getProjectStatus(0), "3")
        })
        it("Should fully pay investors, change paidOut status to true, amountToBePaidOut to 0 and send the rest of ETH back to project owner #1 with multiple investors", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // calculate how much eth we have to pay to investors
            const fullAmoutToBePaidOut =
                await crowdfunding.getFullAmountToBePaidOutToInvestorsWithoutGasFees(0)
            // console.log(`Full amount to be paid out to ivnestors: ${fullAmoutToBePaidOut}`)

            // fund the project as project owner (amount to be paid to investors + gas fees)
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding.connect(projectOwner).ownerFundProject(0, {
                value: amountFundedByOwner,
            })

            // check balance of investors before finishing the project
            const investor1BalanceBefore = await ethers.provider.getBalance(funder1.address)
            const investor2BalanceBefore = await ethers.provider.getBalance(funder2.address)
            const projectOwnerBalanceBefore = await ethers.provider.getBalance(projectOwner.address)
            const projectBalanceBefore = await ethers.provider.getBalance(projectAddress)

            // console.log(
            //     `Investor 1 balance before: ${investor1BalanceBefore}; Investor 2 balance before: ${investor2BalanceBefore}`
            // )
            const amountToBePaidOutToInvestor =
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(0)
            // console.log(`Amount to be paid to investor: ${amountToBePaidOutToInvestor}`)
            // console.log(`Owner balance before: ${projectOwnerBalanceBefore}`)
            // console.log(`Project balance before: ${projectBalanceBefore}`)

            // call finish function as the project owner
            const txResponse = await crowdfunding.connect(projectOwner).finishProject(0)
            const txReceipt = await txResponse.wait()
            const { gasUsed, gasPrice } = txReceipt
            const gasCost = BigInt(gasPrice) * BigInt(gasUsed)
            // check balance of investors after finishing the project
            const investor1BalanceAfter = await ethers.provider.getBalance(funder1.address)
            const investor2BalanceAfter = await ethers.provider.getBalance(funder2.address)
            const projectBalanceAfter = await ethers.provider.getBalance(projectAddress)
            const projectOwnerBalanceAfter = await ethers.provider.getBalance(projectOwner.address)

            // console.log(
            //     `Investor 1 balance after: ${investor1BalanceAfter}; Investor 2 balance after: ${investor2BalanceAfter}`
            // )
            // console.log(`Project balance after: ${projectBalanceAfter}`)
            // console.log(`Owner balance after: ${projectOwnerBalanceAfter}`)

            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(0), true)
            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(1), true)
            assert.equal(await iCrowdfundingProject.getInvestorsAmountToBePaidOut(0), "0")
            assert.equal(await iCrowdfundingProject.getInvestorsAmountToBePaidOut(1), "0")

            assert.equal(
                investor1BalanceAfter - investor1BalanceBefore,
                amountToBePaidOutToInvestor
            )
            assert.equal(
                investor2BalanceAfter - investor2BalanceBefore,
                amountToBePaidOutToInvestor
            )
            assert.equal(projectBalanceAfter, "0")
            assert.equal(
                projectOwnerBalanceAfter,
                BigInt(projectOwnerBalanceBefore) +
                    (BigInt(amountFundedByOwner) - BigInt(fullAmoutToBePaidOut)) -
                    gasCost
            )
        })
        it("Should fully pay investors, change paidOut status to true, amountToBePaidOut to 0 and send the rest of ETH back to project owner #1 with multiple funds from one investor", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // calculate how much eth we have to pay to investors
            const fullAmoutToBePaidOut =
                await crowdfunding.getFullAmountToBePaidOutToInvestorsWithoutGasFees(0)

            // fund the project as project owner (amount to be paid to investors + gas fees)
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding.connect(projectOwner).ownerFundProject(0, {
                value: amountFundedByOwner,
            })

            // check balance of investors before finishing the project
            const investorBalanceBefore = await ethers.provider.getBalance(funder1.address)
            const projectOwnerBalanceBefore = await ethers.provider.getBalance(projectOwner.address)
            const projectBalanceBefore = await ethers.provider.getBalance(projectAddress)

            const amountToBePaidOutToInvestor =
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(0)
            const amountToBePaidOutToInvestor2 =
                await iCrowdfundingProject.getInvestorsAmountToBePaidOut(1)
            // console.log(`Amount to be paid to investor: ${amountToBePaidOutToInvestor}`)

            // call finish function as the project owner
            const txResponse = await crowdfunding.connect(projectOwner).finishProject(0)
            const txReceipt = await txResponse.wait()
            const { gasUsed, gasPrice } = txReceipt
            const gasCost = BigInt(gasPrice) * BigInt(gasUsed)
            // check balance of investors after finishing the project
            const investorBalanceAfter = await ethers.provider.getBalance(funder1.address)
            const projectBalanceAfter = await ethers.provider.getBalance(projectAddress)
            const projectOwnerBalanceAfter = await ethers.provider.getBalance(projectOwner.address)

            // console.log(`Investor 1 balance before: ${investorBalanceBefore}`)
            // console.log(`Investor 1 balance after: ${investorBalanceAfter}`)

            assert.equal(await iCrowdfundingProject.getInvestorsPaidOutStatus(0), true)
            assert.equal(await iCrowdfundingProject.getInvestorsAmountToBePaidOut(0), "0")

            assert.equal(
                investorBalanceAfter,
                investorBalanceBefore + amountToBePaidOutToInvestor + amountToBePaidOutToInvestor2
            )
            assert.equal(projectBalanceAfter, "0")
        })
    })
    describe("Function: withdrawFees", function () {
        beforeEach(async () => {
            // create a new project
            await crowdfunding
                .connect(projectOwner)
                .createProject(
                    ethers.parseEther("30"),
                    interestRateInPercent,
                    minInvestment,
                    maxInvestment,
                    "2",
                    investmentPeriodInDays,
                    {
                        value: ethers.parseEther("0.6"),
                    }
                )
        })
        it("Should revert if called by not deployer", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // call fund and finish function as the project owner
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding.connect(projectOwner).ownerFundProject(0, {
                value: amountFundedByOwner,
            })
            await crowdfunding.connect(projectOwner).finishProject("0")

            await expect(
                crowdfunding.connect(projectOwner).withdrawFees()
            ).to.be.revertedWithCustomError(crowdfunding, "Crowdfunding__CanBeCalledOnlyByOwner")

            await expect(
                crowdfunding.connect(funder1).withdrawFees()
            ).to.be.revertedWithCustomError(crowdfunding, "Crowdfunding__CanBeCalledOnlyByOwner")
        })
        it("Should withdraw eth from the main crowdfunding contract", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            // get project contract and address
            const projectAddress = await crowdfunding.getProjectAddress(0)
            const iCrowdfundingProject = await ethers.getContractAt(
                "ICrowdfundingProject",
                projectAddress,
                deployer
            )

            // mine and increase time and call performUpkeep
            await network.provider.send("evm_increaseTime", [3 * 86400])
            await network.provider.send("evm_mine", [])
            await iCrowdfundingProject.performUpkeep(`0x`)

            // call fund and finish function as the project owner
            const amountFundedByOwner = 34000000000000000000n
            await crowdfunding.connect(projectOwner).ownerFundProject(0, {
                value: amountFundedByOwner,
            })
            await crowdfunding.connect(projectOwner).finishProject("0")

            // check deployers balance before
            const deployerBalanceBefore = await ethers.provider.getBalance(deployer)

            // chek crowdfunding contracts balance
            const crowdfundingBalance = await ethers.provider.getBalance(crowdfunding.target)

            // withraw eth from the crowdfunding contract
            const txResponse = await crowdfunding.connect(deployer).withdrawFees()
            const txReceipt = await txResponse.wait()
            const { gasUsed, gasPrice } = txReceipt
            const gasCost = BigInt(gasPrice) * BigInt(gasUsed)

            // check deployers balance after
            const deployerBalanceAfter = await ethers.provider.getBalance(deployer)
            // console.log(`Deployer balance after: ${deployerBalanceAfter}`)

            // check if the balance of the dpeloyer is correct
            assert.equal(
                deployerBalanceAfter,
                BigInt(deployerBalanceBefore) + BigInt(crowdfundingBalance) - BigInt(gasCost)
            )

            //check if the balance of the contract is zero
            assert.equal(await ethers.provider.getBalance(crowdfunding.target), "0")
        })
    })
    describe("Function: getProjectAmountFunded", function () {
        beforeEach(async () => {
            // create a new project
            await crowdfunding
                .connect(projectOwner)
                .createProject(
                    ethers.parseEther("30"),
                    interestRateInPercent,
                    minInvestment,
                    maxInvestment,
                    "2",
                    investmentPeriodInDays,
                    {
                        value: ethers.parseEther("0.6"),
                    }
                )
        })
        it("Should get the actual funded amount of the project", async function () {
            // fund the project
            await crowdfunding.connect(funder1).fundProject(0, {
                value: maxInvestment,
            })
            await crowdfunding.connect(funder2).fundProject(0, {
                value: maxInvestment,
            })

            assert.equal(await crowdfunding.getProjectAmountFunded(0), BigInt(maxInvestment) * 2n)
        })
    })
})
