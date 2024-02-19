const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper.hardhat.config")
const { verify } = require("../utils/verify")

module.exports = async ({ deployments, getNamedAccounts }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const crowfundFeeInPrecent = networkConfig[chainId]["crowfundFeeInPrecent"]
    const crowfundMinDeadlineInDays = networkConfig[chainId]["crowfundMinDeadlineInDays"]

    const crowdfunding = await deploy("Crowdfunding", {
        from: deployer,
        args: [crowfundFeeInPrecent, crowfundMinDeadlineInDays],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    // Verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(crowdfunding.address, args)
    }
    console.log("---------------------------------------------")
    console.log(`Contract address: ${crowdfunding.address}`)
    console.log("---------------------------------------------")
}

module.exports.tags = ["all", "bid"]
