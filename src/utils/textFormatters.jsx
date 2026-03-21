import React from "react";

export const renderInline = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
};

export const formatText = (text) => {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${key}`}>{listItems}</ul>);
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      listItems.push(<li key={i}>{renderInline(trimmed.slice(2))}</li>);
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      listItems.push(<li key={i}>{renderInline(numMatch[2])}</li>);
      return;
    }

    flushList(i);

    if (trimmed === "") {
      elements.push(<br key={i} />);
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={i} style={{ fontWeight: 600, marginBottom: "4px" }}>
          {renderInline(trimmed.slice(3))}
        </p>
      );
      return;
    }

    elements.push(<p key={i}>{renderInline(trimmed)}</p>);
  });

  flushList("end");
  return elements;
};
