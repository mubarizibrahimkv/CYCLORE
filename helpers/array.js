module.exports = {
    range: (start, end) => {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    },
    includes: function (array, value) {
        if (Array.isArray(array)) {
            return array.includes(value);
        }
        return false;
    },
    or: function () {
        return Array.from(arguments).slice(0, -1).some(Boolean);
    }
};
