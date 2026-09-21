/**
 * Location: tests/readingSortableDom.component.test.tsx
 * Purpose: Verify Reading registers a DOM node with the actual sortable library.
 * Why: A mocked useSortable hook cannot detect a dropped function-component ref.
 */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DndContext, useDndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { SortablePassageCard } from "../src/features/assignments/components/ielts/authoring/SortablePassageCard";

afterEach(cleanup);
test("Reading passage registers a real DOM node for sortable measurement", () => {
  let context: ReturnType<typeof useDndContext>;
  function Probe() {
    context = useDndContext();
    return null;
  }
  render(
    <DndContext>
      <SortableContext items={["one"]}>
        <SortablePassageCard
          id="one"
          index={0}
          title="Passage 1"
          questionCount={0}
          isExpanded={false}
          onToggle={() => {}}
        >
          Content
        </SortablePassageCard>
        <Probe />
      </SortableContext>
    </DndContext>,
  );
  expect(context!.droppableContainers.get("one")?.node.current).toBeInstanceOf(
    HTMLElement,
  );
});
