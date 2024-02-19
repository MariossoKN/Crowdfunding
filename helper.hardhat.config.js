const networkConfig = {
    11155111: {
        name: "sepolia",
        crowfundFeeInPrecent: "2",
        crowfundMinDeadlineInDays: "2",
    },
    31337: {
        name: "hardhat",
        crowfundFeeInPrecent: "2",
        crowfundMinDeadlineInDays: "2",
    },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = { networkConfig, developmentChains }
