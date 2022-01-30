const encodeSpells = require("../../scripts/encodeSpells.js")

const depositCollteral = async (dsa, authority, referrer, currencyId, amount, underlying) => {
    const spells = [
        {
            connector: "NOTIONAL-TEST-A",
            method: "depositCollateral",
            args: [currencyId, underlying, amount, 0, 0]
        }
    ];

    const tx = await dsa.connect(authority).cast(...encodeSpells(spells), referrer.address);
    await tx.wait()
};

const depositAndMintNToken = async (dsa, authority, referrer, currencyId, amount, underlying) => {
    const spells = [
        {
            connector: "NOTIONAL-TEST-A",
            method: "depositAndMintNToken",
            args: [currencyId, amount, underlying, 0, 0]
        }
    ];

    const tx = await dsa.connect(authority).cast(...encodeSpells(spells), referrer.address);
    await tx.wait()
}

const depositERC20 = async (dsa, authority, referrer, token, amount) => {
    const spells = [
        {
            connector: "BASIC-A",
            method: "deposit",
            args: [token, amount, 0, 0]
        }
    ];

    const tx = await dsa.connect(authority).cast(...encodeSpells(spells), referrer.address);
    await tx.wait()
};

module.exports = {
    depositCollteral,
    depositAndMintNToken,
    depositERC20
};
