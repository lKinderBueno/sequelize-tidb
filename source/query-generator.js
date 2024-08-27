"use strict";
var __defProps = Object.defineProperties;
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
const _ = require("lodash");
const Utils = require('sequelize/lib/utils');

const QueryGenerator = require('sequelize/lib/dialects/abstract/query-generator');

QueryGenerator.prototype.selectQuery = function selectQuery(tableName, options, model) {
  options = options || {};
  const limit = options.limit;
  const mainQueryItems = [];
  const subQueryItems = [];
  const subQuery = options.subQuery === void 0 ? limit && options.hasMultiAssociation : options.subQuery;
  const attributes = {
    main: options.attributes && options.attributes.slice(),
    subQuery: null
  };
  const mainTable = {
    name: tableName,
    quotedName: null,
    as: null,
    model
  };
  const topLevelInfo = {
    names: mainTable,
    options,
    subQuery
  };
  let mainJoinQueries = [];
  let subJoinQueries = [];
  let query;
  if (this.options.minifyAliases && !options.aliasesMapping) {
    options.aliasesMapping = /* @__PURE__ */ new Map();
    options.aliasesByTable = {};
    options.includeAliases = /* @__PURE__ */ new Map();
  }
  if (options.tableAs) {
    mainTable.as = this.quoteIdentifier(options.tableAs);
  } else if (!Array.isArray(mainTable.name) && mainTable.model) {
    mainTable.as = this.quoteIdentifier(mainTable.model.name);
  }
  mainTable.quotedName = !Array.isArray(mainTable.name) ? this.quoteTable(mainTable.name) : tableName.map((t) => {
    return Array.isArray(t) ? this.quoteTable(t[0], t[1]) : this.quoteTable(t, true);
  }).join(", ");
  if (subQuery && attributes.main) {
    for (const keyAtt of mainTable.model.primaryKeyAttributes) {
      if (!attributes.main.some((attr) => keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1])) {
        attributes.main.push(mainTable.model.rawAttributes[keyAtt].field ? [keyAtt, mainTable.model.rawAttributes[keyAtt].field] : keyAtt);
      }
    }
  }
  attributes.main = this.escapeAttributes(attributes.main, options, mainTable.as);
  attributes.main = attributes.main || (options.include ? [`${mainTable.as}.*`] : ["*"]);
  if (subQuery || options.groupedLimit) {
    attributes.subQuery = attributes.main;
    attributes.main = [`${mainTable.as || mainTable.quotedName}.*`];
  }
  if (options.include) {
    for (const include of options.include) {
      if (include.separate) {
        continue;
      }
      const joinQueries = this.generateInclude(include, { externalAs: mainTable.as, internalAs: mainTable.as }, topLevelInfo);
      subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
      mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);
      if (joinQueries.attributes.main.length > 0) {
        attributes.main = _.uniq(attributes.main.concat(joinQueries.attributes.main));
      }
      if (joinQueries.attributes.subQuery.length > 0) {
        attributes.subQuery = _.uniq(attributes.subQuery.concat(joinQueries.attributes.subQuery));
      }
    }
  }
  if (subQuery) {
    subQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.subQuery, mainTable.quotedName, mainTable.as));
    subQueryItems.push(subJoinQueries.join(""));
  } else {
    if (options.groupedLimit) {
      if (!mainTable.as) {
        mainTable.as = mainTable.quotedName;
      }
      const where = __spreadValues({}, options.where);
      let groupedLimitOrder, whereKey, include, groupedTableName = mainTable.as;
      if (typeof options.groupedLimit.on === "string") {
        whereKey = options.groupedLimit.on;
      } else if (options.groupedLimit.on instanceof HasMany) {
        whereKey = options.groupedLimit.on.foreignKeyField;
      }
      if (options.groupedLimit.on instanceof BelongsToMany) {
        groupedTableName = options.groupedLimit.on.manyFromSource.as;
        const groupedLimitOptions = Model._validateIncludedElements({
          include: [{
            association: options.groupedLimit.on.manyFromSource,
            duplicating: false,
            required: true,
            where: __spreadValues({
              [Op.placeholder]: true
            }, options.groupedLimit.through && options.groupedLimit.through.where)
          }],
          model
        });
        options.hasJoin = true;
        options.hasMultiAssociation = true;
        options.includeMap = Object.assign(groupedLimitOptions.includeMap, options.includeMap);
        options.includeNames = groupedLimitOptions.includeNames.concat(options.includeNames || []);
        include = groupedLimitOptions.include;
        if (Array.isArray(options.order)) {
          options.order.forEach((order, i) => {
            if (Array.isArray(order)) {
              order = order[0];
            }
            let alias = `subquery_order_${i}`;
            options.attributes.push([order, alias]);
            alias = this.sequelize.literal(this.quote(alias));
            if (Array.isArray(options.order[i])) {
              options.order[i][0] = alias;
            } else {
              options.order[i] = alias;
            }
          });
          groupedLimitOrder = options.order;
        }
      } else {
        groupedLimitOrder = options.order;
        if (!this._dialect.supports.topLevelOrderByRequired) {
          delete options.order;
        }
        where[Op.placeholder] = true;
      }
      const baseQuery = `SELECT * FROM (${this.selectQuery(tableName, {
        attributes: options.attributes,
        offset: options.offset,
        limit: options.groupedLimit.limit,
        order: groupedLimitOrder,
        aliasesMapping: options.aliasesMapping,
        aliasesByTable: options.aliasesByTable,
        where,
        include,
        model
      }, model).replace(/;$/, "")}) ${this.getAliasToken()} sub`;
      const placeHolder = this.whereItemQuery(Op.placeholder, true, { model });
      const splicePos = baseQuery.indexOf(placeHolder);
      mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, `(${options.groupedLimit.values.map((value) => {
        let groupWhere;
        if (whereKey) {
          groupWhere = {
            [whereKey]: value
          };
        }
        if (include) {
          groupWhere = {
            [options.groupedLimit.on.foreignIdentifierField]: value
          };
        }
        return Utils.spliceStr(baseQuery, splicePos, placeHolder.length, this.getWhereConditions(groupWhere, groupedTableName));
      }).join(this._dialect.supports["UNION ALL"] ? " UNION ALL " : " UNION ")})`, mainTable.as));
    } else {
      mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, mainTable.quotedName, mainTable.as));
    }
    mainQueryItems.push(mainJoinQueries.join(""));
  }

  if (options.compromiseConsistency === true)
    mainQueryItems.push(" AS OF TIMESTAMP NOW() - INTERVAL 10 SECOND");
  
  if (Object.prototype.hasOwnProperty.call(options, "where") && !options.groupedLimit) {
    options.where = this.getWhereConditions(options.where, mainTable.as || tableName, model, options);
    if (options.where) {
      if (subQuery) {
        subQueryItems.push(` WHERE ${options.where}`);
      } else {
        mainQueryItems.push(` WHERE ${options.where}`);
        mainQueryItems.forEach((value, key) => {
          if (value.startsWith("SELECT")) {
            mainQueryItems[key] = this.selectFromTableFragment(options, model, attributes.main, mainTable.quotedName, mainTable.as, options.where);
          }
        });
      }
    }
  }
  if (options.group) {
    options.group = Array.isArray(options.group) ? options.group.map((t) => this.aliasGrouping(t, model, mainTable.as, options)).join(", ") : this.aliasGrouping(options.group, model, mainTable.as, options);
    if (subQuery && options.group) {
      subQueryItems.push(` GROUP BY ${options.group}`);
    } else if (options.group) {
      mainQueryItems.push(` GROUP BY ${options.group}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(options, "having")) {
    options.having = this.getWhereConditions(options.having, tableName, model, options, false);
    if (options.having) {
      if (subQuery) {
        subQueryItems.push(` HAVING ${options.having}`);
      } else {
        mainQueryItems.push(` HAVING ${options.having}`);
      }
    }
  }
  if (options.order) {
    const orders = this.getQueryOrders(options, model, subQuery);
    if (orders.mainQueryOrder.length) {
      mainQueryItems.push(` ORDER BY ${orders.mainQueryOrder.join(", ")}`);
    }
    if (orders.subQueryOrder.length) {
      subQueryItems.push(` ORDER BY ${orders.subQueryOrder.join(", ")}`);
    }
  }
  const limitOrder = this.addLimitAndOffset(options, mainTable.model);
  if (limitOrder && !options.groupedLimit) {
    if (subQuery) {
      subQueryItems.push(limitOrder);
    } else {
      mainQueryItems.push(limitOrder);
    }
  }
  if (subQuery) {
    this._throwOnEmptyAttributes(attributes.main, { modelName: model && model.name, as: mainTable.as });
    query = `SELECT ${attributes.main.join(", ")} FROM (${subQueryItems.join("")}) ${this.getAliasToken()} ${mainTable.as}${mainJoinQueries.join("")}${mainQueryItems.join("")}`;
  } else {
    query = mainQueryItems.join("");
  }
  if (options.lock && this._dialect.supports.lock) {
    let lock = options.lock;
    if (typeof options.lock === "object") {
      lock = options.lock.level;
    }
    if (this._dialect.supports.lockKey && ["KEY SHARE", "NO KEY UPDATE"].includes(lock)) {
      query += ` FOR ${lock}`;
    } else if (lock === "SHARE") {
      query += ` ${this._dialect.supports.forShare}`;
    } else {
      query += " FOR UPDATE";
    }
    if (this._dialect.supports.lockOf && options.lock.of && options.lock.of.prototype instanceof Model) {
      query += ` OF ${this.quoteTable(options.lock.of.name)}`;
    }
    if (this._dialect.supports.skipLocked && options.skipLocked) {
      query += " SKIP LOCKED";
    }
  }
  return `${query};`;
}