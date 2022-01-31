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
const MaxUint96 = BigNumber.from("0xffffffffffffffffffffffff");
const DEPOSIT_ASSET = 1;
const DEPOSIT_UNDERLYING = 2;
const DEPOSIT_ASSET_MINT_NTOKEN = 3;
const DEPOSIT_UNDERLYING_MINT_NTOKEN = 4;

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
            const depositAmount = ethers.utils.parseUnits("1", 8);
            await cethToken.connect(cethWhale).transfer(wallet0.address, depositAmount);
            await cethToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cethToken.address, depositAmount);
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 1, depositAmount, false);
            const bal = await notional.callStatic.getAccountBalance(1, dsaWallet0.address);
            // balance in internal asset precision
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("100000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseUnits("0", 0));
        });

        it("test_deposit_DAI_underlying", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 18);
            await daiToken.connect(daiWhale).transfer(wallet0.address, depositAmount);
            await daiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, daiToken.address, depositAmount);
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 2, depositAmount, true);
            const bal = await notional.callStatic.getAccountBalance(2, dsaWallet0.address);
            // balance in internal asset precision
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("4500000000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseUnits("0", 0));
        });

        it("test_deposit_DAI_asset", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
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
        it("test_deposit_ETH_underlying_and_lend", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("10");
            await helpers.depositAndLend(dsaWallet0, wallet0, wallet1, 1, true, depositAmount, 1, 9e8, 0);
            const portfolio = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(portfolio.length).to.be.equal(1);
            expect(portfolio[0][3]).to.be.gte(ethers.utils.parseUnits("900000000", 0));
        });

        it("test_deposit_ETH_asset_and_lend", async function () {
            const depositAmount = ethers.utils.parseUnits("1", 8);
            await cethToken.connect(cethWhale).transfer(wallet0.address, depositAmount);
            await cethToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cethToken.address, depositAmount);
            await helpers.depositAndLend(dsaWallet0, wallet0, wallet1, 1, false, depositAmount, 1, 0.01e8, 0);
            const portfolio = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(portfolio.length).to.be.equal(1);
            expect(portfolio[0][3]).to.be.gte(ethers.utils.parseUnits("1000000", 0));
        });

        it("test_deposit_DAI_underlying_and_lend", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 18);
            await daiToken.connect(daiWhale).transfer(wallet0.address, depositAmount);
            await daiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, daiToken.address, depositAmount);
            await helpers.depositAndLend(dsaWallet0, wallet0, wallet1, 2, true, depositAmount, 1, 100e8, 0);
            const portfolio = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(portfolio.length).to.be.equal(1);
            expect(portfolio[0][3]).to.be.gte(ethers.utils.parseUnits("10000000000", 0));
        });

        it("test_deposit_DAI_asset_and_lend", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositAndLend(dsaWallet0, wallet0, wallet1, 2, false, depositAmount, 1, 10e8, 0);
            const portfolio = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(portfolio.length).to.be.equal(1);
            expect(portfolio[0][3]).to.be.gte(ethers.utils.parseUnits("1000000000", 0));
        });

        it("test_withdraw_lend_ETH", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("10");
            await helpers.depositAndLend(dsaWallet0, wallet0, wallet1, 1, true, depositAmount, 1, 9e8, 0);
            const before = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(before.length).to.be.equal(1);
            expect(before[0][3]).to.be.gte(ethers.utils.parseUnits("900000000", 0));
            await helpers.withdrawLend(dsaWallet0, wallet0, wallet1, 1, 1, 9e8, 0);
            const after = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(after.length).to.be.equal(0);
        });
    });

    describe("Borrow Tests", function () {
        it("test_deposit_ETH_and_borrow_DAI_underlying", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("10");
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 1, DEPOSIT_UNDERLYING, depositAmount, 2, 1, 1000e8, 0, true
            );
            expect(await daiToken.balanceOf(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("990"));
        });

        it("test_deposit_ETH_and_borrow_DAI_asset", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("10");
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 1, DEPOSIT_UNDERLYING, depositAmount, 2, 1, 1000e8, 0, false
            );
            expect(await cdaiToken.balanceOf(dsaWallet0.address)).to.be.gte(ethers.utils.parseUnits("4500000000000", 0));
        });

        it("test_deposit_DAI_underlying_and_borrow_ETH", async function () {
            const depositAmount = ethers.utils.parseUnits("20000", 18);
            await daiToken.connect(daiWhale).transfer(wallet0.address, depositAmount);
            await daiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, daiToken.address, depositAmount);
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 2, DEPOSIT_UNDERLYING, depositAmount, 1, 1, 1e8, 0, true
            );
            expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("0.99"));
        });

        it("test_deposit_DAI_asset_and_borrow_ETH", async function () {
            const depositAmount = ethers.utils.parseUnits("1000000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 2, DEPOSIT_ASSET, depositAmount, 1, 1, 1e8, 0, true
            );
            expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("0.99"));
        });

        it("test_mint_nDAI_underlying_and_borrow_ETH", async function () {
            const depositAmount = ethers.utils.parseUnits("20000", 18);
            await daiToken.connect(daiWhale).transfer(wallet0.address, depositAmount);
            await daiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, daiToken.address, depositAmount);
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 2, DEPOSIT_UNDERLYING_MINT_NTOKEN, depositAmount, 1, 1, 1e8, 0, true
            );
            expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("0.99"));
        });

        it("test_mint_nDAI_asset_and_borrow_ETH", async function () {
            const depositAmount = ethers.utils.parseUnits("1000000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 2, DEPOSIT_ASSET_MINT_NTOKEN, depositAmount, 1, 1, 1e8, 0, true
            );
            expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("0.99"));
        });
    });

    describe("Withdraw Tests", function () {
        it("test_withdraw_ETH_underlying", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("1"); // 1 ETH
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 1, depositAmount, true);
            await helpers.withdrawCollateral(dsaWallet0, wallet0, wallet1, 1, ethers.constants.MaxUint256, true);
            expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(ethers.utils.parseEther("10"));
        });

        it("test_withdraw_ETH_asset", async function () {
            await wallet0.sendTransaction({
                to: dsaWallet0.address,
                value: ethers.utils.parseEther("10")
            });
            const depositAmount = ethers.utils.parseEther("1"); // 1 ETH
            await helpers.depositCollteral(dsaWallet0, wallet0, wallet1, 1, depositAmount, true);
            await helpers.withdrawCollateral(dsaWallet0, wallet0, wallet1, 1, ethers.constants.MaxUint256, false);
            expect(await cethToken.balanceOf(dsaWallet0.address)).to.be.gte(ethers.utils.parseUnits("4900000000", 0));
        });

        it("test_redeem_DAI_raw", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositAndMintNToken(dsaWallet0, wallet0, wallet1, 2, depositAmount, false);
            await helpers.redeemNTokenRaw(dsaWallet0, wallet0, wallet1, 2, true, MaxUint96)
            const bal = await notional.callStatic.getAccountBalance(2, dsaWallet0.address);
            expect(bal[0]).to.be.gte(ethers.utils.parseUnits("99000000000", 0));
            expect(bal[1]).to.be.equal(ethers.utils.parseEther("0"));
        });

        it("test_redeem_DAI_and_withdraw_redeem", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositAndMintNToken(dsaWallet0, wallet0, wallet1, 2, depositAmount, false);
            await helpers.redeemNTokenAndWithdraw(dsaWallet0, wallet0, wallet1, 2, MaxUint96, ethers.constants.MaxUint256, true);
            const bal = await notional.callStatic.getAccountBalance(2, dsaWallet0.address);
            expect(bal[0]).to.be.equal(ethers.utils.parseEther("0"));
            expect(bal[1]).to.be.equal(ethers.utils.parseEther("0"));
        });

        it("test_redeem_DAI_and_withdraw_no_redeem", async function () {
            const depositAmount = ethers.utils.parseUnits("1000", 8);
            await cdaiToken.connect(cdaiWhale).transfer(wallet0.address, depositAmount);
            await cdaiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, cdaiToken.address, depositAmount);
            await helpers.depositAndMintNToken(dsaWallet0, wallet0, wallet1, 2, depositAmount, false);
            expect(await cdaiToken.balanceOf(dsaWallet0.address)).to.be.equal(ethers.utils.parseEther("0"));
            await helpers.redeemNTokenAndWithdraw(dsaWallet0, wallet0, wallet1, 2, MaxUint96, ethers.constants.MaxUint256, false);
            const bal = await notional.callStatic.getAccountBalance(2, dsaWallet0.address);
            expect(bal[0]).to.be.equal(ethers.utils.parseEther("0"));
            expect(bal[1]).to.be.equal(ethers.utils.parseEther("0"));
            expect(await cdaiToken.balanceOf(dsaWallet0.address)).to.be.gte(ethers.utils.parseUnits("99000000000", 0));
        });

        it("test_redeem_DAI_and_deleverage", async function () {
            const depositAmount = ethers.utils.parseUnits("20000", 18);
            await daiToken.connect(daiWhale).transfer(wallet0.address, depositAmount);
            await daiToken.connect(wallet0).approve(dsaWallet0.address, ethers.constants.MaxUint256);
            await helpers.depositERC20(dsaWallet0, wallet0, wallet1, daiToken.address, depositAmount);
            await helpers.depositCollateralBorrowAndWithdraw(
                dsaWallet0, wallet0, wallet1, 2, DEPOSIT_UNDERLYING, depositAmount, 1, 1, 1e8, 0, true
            );
            const bal = await ethers.provider.getBalance(dsaWallet0.address);
            await helpers.depositAndMintNToken(dsaWallet0, wallet0, wallet1, 1, bal, true);
            const before = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(before.length).to.be.equal(1);
            expect(before[0][3]).to.be.lte(ethers.utils.parseUnits("-100000000", 0));
            await helpers.redeemNTokenAndDeleverage(dsaWallet0, wallet0, wallet1, 1, MaxUint96, 1, 0.98e8, 0);
            const after = await notional.getAccountPortfolio(dsaWallet0.address);
            expect(after.length).to.be.equal(1);
            expect(after[0][3]).to.be.lte(ethers.utils.parseUnits("-2000000", 0));
        });
    });
});
