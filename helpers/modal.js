module.exports = {
    showModal: function (context, options) {
      if (context) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  };
  