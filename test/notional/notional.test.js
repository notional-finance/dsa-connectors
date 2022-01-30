const { expect } = require("chai");
const hre = require("hardhat");
const { web3, deployments, waffle, ethers } = hre;
const { provider, deployContract } = waffle

const deployAndEnableConnector = require("../../scripts/deployAndEnableConnector.js")
const buildDSAv2 = require("../../scripts/buildDSAv2")
const encodeSpells = require("../../scripts/encodeSpells.js")
const getMasterSigner = require("../../scripts/getMasterSigner")

const addresses = require("../../scripts/constant/addresses");
const abis = require("../../scripts/constant/abis");
const constants = require("../../scripts/constant/constant");
const tokens = require("../../scripts/constant/tokens");

const contracts = require("./notional.contracts");
const helpers = require("./notional.helpers");

const connectV2NotionalArtifacts = require("../../artifacts/contracts/mainnet/connectors/notional/main.sol/ConnectV2Notional.json");
const { BigNumber } = require("ethers");

const DAI_WHALE = "0x6dfaf865a93d3b0b5cfd1b4db192d1505676645b";
const CDAI_WHALE = "0x33b890d6574172e93e58528cd99123a88c0756e9";
const ETH_WHALE = "0x7D24796f7dDB17d73e8B1d0A3bbD103FBA2cb2FE";
const CETH_WHALE = "0x1a1cd9c606727a7400bb2da6e4d5c70db5b4cade";

describe("Notional", function () {
    const connectorName = "NOTIONAL-TEST-A"

    let dsaWallet0
    let masterSigner;
    let instaConnectorsV2;
    let connector;
    let notional;
    let daiToken;
    let cdaiToken;
    let cethToken;
    let weth;
    let daiWhale;
    let cdaiWhale;
    let cethWhale;

    const wallets = provider.getWallets()
    const [wallet0, wallet1, wallet2, wallet3] = wallets
    beforeEach(async () => {
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: hre.config.networks.hardhat.forking.url,
                        blockNumber: 13798624,
                    },
                },
            ],
        });
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [DAI_WHALE]
        })
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [CDAI_WHALE]
        })
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ETH_WHALE]
        })
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [CETH_WHALE]
        })

        masterSigner = await getMasterSigner(wallet3)
        instaConnectorsV2 = await ethers.getContractAt(abis.core.connectorsV2, addresses.core.connectorsV2);
        connector = await deployAndEnableConnector({
            connectorName,
            contractArtifact: connectV2NotionalArtifacts,
            signer: masterSigner,
            connectors: instaConnectorsV2
        })
        notional = new ethers.Contract(
            contracts.NOTIONAL_CONTRACT_ADDRESS,
            contracts.NOTIONAL_CONTRACT_ABI,
            ethers.provider
        );
        daiToken = new ethers.Contract(
            contracts.DAI_TOKEN_ADDRESS,
            contracts.ERC20_TOKEN_ABI,
            ethers.provider
        );
        daiWhale = await ethers.getSigner(DAI_WHALE);
        cdaiToken = new ethers.Contract(
            contracts.CDAI_TOKEN_ADDRESS,
            contracts.ERC20_TOKEN_ABI,
            ethers.provider
        );
        cdaiWhale = await ethers.getSigner(CDAI_WHALE);
        cethToken = new ethers.Contract(
            contracts.CETH_TOKEN_ADDRESS,
            contracts.ERC20_TOKEN_ABI,
            ethers.provider
        );
        cethWhale = await ethers.getSigner(CETH_WHALE);
        weth = new ethers.Contract(
            contracts.WETH_TOKEN_ADDRESS,
            contracts.ERC20_TOKEN_ABI,
            ethers.provider
        );
        dsaWallet0 = await buildDSAv2(wallet0.address)
    });

    describe("Deposit Tests", function () {
        it("test_deposit_ETH_underlying", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("1"); // 1 ETH
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 1, depositAmount, true);
            const bal = await notional.callStatic.getAccountBalance(1, dsaWallet0.address);
            // balance in internal asset precision
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("4900000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseUnits("0", 0));
        });

        it("test_deposit_ETH_asset", async function () {
            const transferAmount = ethers.utils.parseUnits("2", 8);
            const depositAmount = ethers.utils.parseUnits("1", 8);
            await cethToken.connect(cethWhale).transfer(wallet0.address, transferAmount);
            await cethToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cethToken.address, depositAmount);
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 1, depositAmount, false);
            const bal = await notional.callStatic.getAccountBalance(1, dsaWallet0.address);
            // balance in internal asset precision
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("100000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseUnits("0", 0));
        });

        it("test_deposit_DAI_underlying", async function () {
            const transferAmount = ethers.utils.parseUnits("2000", 18);
            const depositAmount = ethers.utils.parseUnits("1000", 18);
            await daiToken.connect(daiWhale).transfer(wallet0.address, transferAmount);
            await daiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, daiToken.address, depositAmount);
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 2, depositAmount, true);
            const bal = await notional.callStatic.getAccountBalance(2, dsaWallet0.address);
            // balance in internal asset precision
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("4500000000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseUnits("0", 0));
        });

        it("test_deposit_DAI_asset", async function () {
            const transferAmount = ethers.utils.parseUnits("2000", 8);
            const depositAmount = ethers.utils.parseUnits("1000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, transferAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 2, depositAmount, false);
            const bal = await notional.callStatic.getAccountBalance(2, dsaWallet0.address);
            // balance in internal asset precision
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("100000000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseUnits("0", 0));
        });

        it("test_deposit_ETH_underlying_and_mint_ntoken", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("1"); // 1 ETH
            await helpers.depositAndMintNToken(dsaWallet0, wallet0, wallet1, 1, depositAmount, true);
            const bal = await notional.callStatic.getAccountBalance(1, dsaWallet0.address);
            expect(bal[0]).to.be.equal(ethers.utils.parseUnits("0", 0));
            expect(bal[1]).to.be.gte(ethers.utils.parseUnits("4900000000", 0));
        });
    });

    describe("Lend Tests", function () {

    });

    describe("Borrow Tests", function () {

    });

    describe("Withdraw Tests", function () {

    });
});
