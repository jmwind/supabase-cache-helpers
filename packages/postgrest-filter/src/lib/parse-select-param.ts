import XRegExp from "xregexp";
import { Path } from "./types";

export const parseSelectParam = (s: string, currentPath?: Path): Path[] => {
  s = s.replace(/\s/g, "");

  const foreignTables = XRegExp.matchRecursive(
    `,${s}`,
    ",[^,]*\\(",
    "\\)",
    "g",
    {
      valueNames: {
        "0": null,
        "1": "tableName",
        "2": "selectedColumns",
        "3": null,
      },
    }
  ).reduce((prev, curr, idx, matches) => {
    if (curr.name === "selectedColumns") {
      const name = matches[idx - 1].value.slice(1, -1);
      prev = { ...prev, [name]: curr.value };
    }
    return prev;
  }, {});

  const columns = s
    .replace(
      new RegExp(
        `${Object.entries(foreignTables)
          .map(([table, selectedColumns]) =>
            `${table}(${selectedColumns})`
              .replace(/\(/g, "\\(")
              .replace(/\)/g, "\\)")
          )
          .join("|")}`,
        "g"
      ),
      ""
    )
    .replace(/(,)\1+/g, ",")
    .split(",")
    .filter((c) => c.length > 0)
    .map((c) => {
      const split = c.split(":");
      const hasAlias = split.length > 1;
      return {
        alias:
          hasAlias || currentPath?.alias
            ? [currentPath?.alias ?? currentPath?.path, split[0]]
                .filter(Boolean)
                .join(".")
            : undefined,
        path: [currentPath?.path, split[hasAlias ? 1 : 0]]
          .filter(Boolean)
          .join("."),
      };
    });

  if (columns.find((c) => c.path.includes("*")))
    throw new Error("Wildcard selector is not supported");

  return [
    ...columns,
    ...Object.entries(foreignTables).flatMap(([table, selectedColumns]) => {
      const tableSplit = table.split(":");
      const hasAlias = tableSplit.length > 1;

      const path = [
        currentPath?.path,
        tableSplit[tableSplit.length - 1].split("!").shift(),
      ]
        .filter(Boolean)
        .join(".");

      const alias = [
        currentPath?.alias,
        hasAlias ? tableSplit[0].split("!").shift() : undefined,
      ]
        .filter(Boolean)
        .join(".");

      return parseSelectParam(`${selectedColumns}`, {
        path,
        alias: alias.length > 0 ? alias : undefined,
      });
    }),
  ];
};
