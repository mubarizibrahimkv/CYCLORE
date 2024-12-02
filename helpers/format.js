module.exports = {
    json: function (context) {
        return JSON.stringify(context);
    },
    eq: (a, b) => a === b,
    toFixed: function (value, decimalPlaces) {
        return value.toFixed(decimalPlaces);
    },
    formatNumber: function (number) {
        if (typeof number === 'number') {
            return number.toLocaleString();
        }
        return number;
    }
};
