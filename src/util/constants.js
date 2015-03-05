define(function(require, module, exports) {
  return {
    ADD_CELL: 1,
    MOD_CELL: 2,

    DATA: "data",
    FIELDS:  "fields",
    SCALES:  "scales",
    SIGNAL:  "signal",
    SIGNALS: "signals",
    
    GROUP: "group",
    
    ENTER: "enter",
    UPDATE: "update",
    EXIT: "exit",

    SENTINEL: {"sentinel": 1},

    ADD: "add",
    REMOVE: "remove",
    TOGGLE: "toggle",
    CLEAR: "clear",

    LINEAR: "linear",
    ORDINAL: "ordinal",
    LOG: "log",
    POWER: "pow",
    TIME: "time",
    QUANTILE: "quantile",

    DOMAIN: "domain",
    RANGE: "range",

    MARK: "mark",
    AXIS: "axis",

    COUNT: "count",
    MIN: "min",
    MAX: "max",

    ASC: "asc",
    DESC: "desc"
  }
});