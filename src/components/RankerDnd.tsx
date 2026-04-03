import { useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import type { VoteOption } from '../utils/voteSession';

function OptionCard({ option, index, ordinalLabel, drag, snapshot }: {
  option: VoteOption;
  index: number;
  ordinalLabel: string[];
  drag: Parameters<Parameters<typeof Draggable>[0]['children']>[0];
  snapshot: Parameters<Parameters<typeof Draggable>[0]['children']>[1];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      ref={drag.innerRef}
      {...drag.draggableProps}
      className={`bg-white border rounded-xl shadow-sm select-none transition-shadow ${
        snapshot.isDragging
          ? 'shadow-lg border-indigo-300 ring-2 ring-indigo-200'
          : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      {/* Main row — drag handle here */}
      <div {...drag.dragHandleProps} className="flex items-center gap-3 px-4 py-3 cursor-grab">
        {/* Rank badge */}
        <span className="flex-shrink-0 w-10 text-center text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg py-1">
          {ordinalLabel[index] ?? `${index + 1}th`}
        </span>

        {/* Drag handle */}
        <span className="text-stone-300 text-lg leading-none">⠿</span>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-stone-800">{option.label}</p>
        </div>

        {/* Info toggle — stops drag from firing */}
        {option.description && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg border transition-colors ${
              expanded
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                : 'border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300'
            }`}
            title={expanded ? 'Hide description' : 'What is this?'}
          >
            {expanded ? 'Less' : 'Info'}
          </button>
        )}
      </div>

      {/* Expandable description — not a drag handle */}
      {expanded && option.description && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="px-4 pb-3 pt-0"
        >
          <p className="text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-2">
            {option.description}
          </p>
        </div>
      )}
    </li>
  );
}

interface Props {
  participantName: string;
  options: VoteOption[];
  onSubmit: (ranking: string[]) => void;
}

export default function RankerDnd({ participantName, options, onSubmit }: Props) {
  const [items, setItems] = useState<VoteOption[]>(() => [...options]);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const next = [...items];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setItems(next);
  }

  const ordinalLabel = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-2">
          <span className="text-lg">🗳</span> Ranking for <strong>{participantName}</strong>
        </div>
        <p className="text-sm text-stone-500">
          Drag to reorder — top is your <strong>first choice</strong>.
        </p>
      </div>

      {/* Drag list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="ranker">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2"
            >
              {items.map((option, index) => (
                <Draggable key={option.id} draggableId={option.id} index={index}>
                  {(drag, snapshot) => (
                    <OptionCard
                      option={option}
                      index={index}
                      ordinalLabel={ordinalLabel}
                      drag={drag}
                      snapshot={snapshot}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      {/* Submit */}
      <button
        onClick={() => onSubmit(items.map((o) => o.id))}
        className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow transition-colors"
      >
        Submit My Ranking →
      </button>
    </div>
  );
}
