import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
} from "@otocho/ui";
import {
  addDevice,
  addParam,
  createPresetDevice,
  createPresetParam,
  removeDevice,
  removeParam,
  reorderDevices,
  updateDevice,
  updateParam,
  type PresetDevice,
  type PresetPage as PresetPageType,
  type PresetParam,
} from "@otocho/core";
import { useAutosave } from "./useAutosave";

export interface PresetPageProps {
  page: PresetPageType;
  onSave: (transform: (page: PresetPageType) => PresetPageType) => Promise<void>;
}

export function PresetPage({ page, onSave }: PresetPageProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    page.devices[0]?.id ?? null,
  );

  // Derive the shown device: fall back to the first when the stored selection
  // is stale (the page switched, or the selected device was removed).
  const selectedDevice =
    page.devices.find((d) => d.id === selectedDeviceId) ?? page.devices[0] ?? null;

  function handleAddDevice() {
    const device = createPresetDevice();
    void onSave((p) => addDevice(p, device)).then(() => setSelectedDeviceId(device.id));
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h3 className="font-display text-lg font-semibold text-fg-primary">{page.title}</h3>

      <DeviceChain
        devices={page.devices}
        selectedId={selectedDevice?.id ?? null}
        onSelect={setSelectedDeviceId}
        onAdd={handleAddDevice}
        onReorder={(fromId, toId) => onSave((p) => reorderDevices(p, fromId, toId))}
      />

      {page.devices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={handleAddDevice}
            className="flex items-center gap-2 text-sm text-fg-tertiary hover:text-fg-primary"
          >
            <Plus className="h-4 w-4" /> Add first device
          </button>
        </div>
      ) : selectedDevice ? (
        <DeviceDetailPanel
          key={selectedDevice.id}
          device={selectedDevice}
          onUpdateName={(name) => onSave((p) => updateDevice(p, selectedDevice.id, { name }))}
          onUpdateSettings={(settings) =>
            onSave((p) => updateDevice(p, selectedDevice.id, { settings }))
          }
          onDelete={() => onSave((p) => removeDevice(p, selectedDevice.id))}
          onAddParam={() => onSave((p) => addParam(p, selectedDevice.id, createPresetParam()))}
          onUpdateParam={(paramId, patch) =>
            onSave((p) => updateParam(p, selectedDevice.id, paramId, patch))
          }
          onDeleteParam={(paramId) => onSave((p) => removeParam(p, selectedDevice.id, paramId))}
        />
      ) : null}
    </div>
  );
}

function DeviceChain({
  devices,
  selectedId,
  onSelect,
  onAdd,
  onReorder,
}: {
  devices: PresetDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  if (devices.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={devices.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {devices.map((device, i) => (
            <div key={device.id} className="flex items-center gap-1 shrink-0">
              <SortableDeviceNode
                device={device}
                isSelected={device.id === selectedId}
                onSelect={() => onSelect(device.id)}
              />
              {i < devices.length - 1 && (
                <span className="text-fg-tertiary text-xs select-none">→</span>
              )}
            </div>
          ))}
          <span className="text-fg-tertiary text-xs select-none mx-1">→</span>
          <button
            type="button"
            aria-label="Add device"
            onClick={onAdd}
            className="flex shrink-0 items-center gap-1 rounded-md border border-dashed border-brand-rule px-3 py-1.5 text-xs text-fg-tertiary hover:border-fg-tertiary hover:text-fg-primary"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableDeviceNode({
  device,
  isSelected,
  onSelect,
}: {
  device: PresetDevice;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: device.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className={[
          "rounded-md border px-3 py-1.5 text-xs transition-colors cursor-pointer",
          isSelected
            ? "border-fg-primary bg-surface-hover text-fg-primary"
            : "border-brand-rule text-fg-secondary hover:border-fg-tertiary hover:text-fg-primary",
        ].join(" ")}
      >
        {device.name}
      </button>
    </div>
  );
}

function DeviceDetailPanel({
  device,
  onUpdateName,
  onUpdateSettings,
  onDelete,
  onAddParam,
  onUpdateParam,
  onDeleteParam,
}: {
  device: PresetDevice;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateSettings: (settings: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddParam: () => Promise<void>;
  onUpdateParam: (paramId: string, patch: Partial<PresetParam>) => Promise<void>;
  onDeleteParam: (paramId: string) => Promise<void>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(device.name);
  const [settings, setSettings, settingsSaveState] = useAutosave(
    device.settings,
    onUpdateSettings,
    device.id,
  );

  const settingsLabel =
    settingsSaveState === "saving" ? "Saving…" : settingsSaveState === "saved" ? "Saved" : null;

  async function submitName(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (trimmed.length > 0) await onUpdateName(trimmed);
    setEditingName(false);
  }

  function cancelNameEdit(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setNameDraft(device.name); setEditingName(false); }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {/* Device name + delete */}
      <div className="flex items-center gap-3">
        {editingName ? (
          <form onSubmit={submitName} className="flex items-center gap-2 flex-1">
            <Input
              aria-label="Device name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={cancelNameEdit}
              onBlur={submitName}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { setNameDraft(device.name); setEditingName(true); }}
            className="font-display text-base font-semibold text-fg-primary hover:text-fg-secondary text-left"
            aria-label="Edit device name"
          >
            {device.name}
          </button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto text-fg-tertiary hover:text-destructive" aria-label="Delete device">
              <X className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this device?</AlertDialogTitle>
              <AlertDialogDescription>
                "{device.name}" will be permanently removed from the chain.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void onDelete()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Settings */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">Settings</span>
          {settingsLabel ? (
            <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
              {settingsLabel}
            </span>
          ) : null}
        </div>
        <textarea
          aria-label="Device settings"
          value={settings}
          onChange={(e) => setSettings(e.target.value)}
          placeholder="Free-text notes about this device…"
          rows={3}
          className={[
            "resize-none rounded-md bg-otocho-canvas p-3",
            "font-sans text-sm leading-relaxed text-fg-primary placeholder:text-fg-tertiary",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          ].join(" ")}
        />
      </div>

      {/* Parameters */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">Parameters</span>
        {device.params.length > 0 && (
          <div className="flex flex-col gap-1" role="list" aria-label="Parameters">
            {device.params.map((param) => (
              <ParamRow
                key={param.id}
                param={param}
                onUpdate={(patch) => onUpdateParam(param.id, patch)}
                onDelete={() => onDeleteParam(param.id)}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void onAddParam()}
          className="flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary w-fit"
        >
          <Plus className="h-3 w-3" /> add parameter
        </button>
      </div>
    </div>
  );
}

function ParamRow({
  param,
  onUpdate,
  onDelete,
}: {
  param: PresetParam;
  onUpdate: (patch: Partial<PresetParam>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [key, setKey] = useAutosave(param.key, (value) => onUpdate({ key: value }), param.id);
  const [value, setValue] = useAutosave(param.value, (v) => onUpdate({ value: v }), param.id);

  return (
    <div role="listitem" className="flex items-center gap-2">
      <input
        aria-label="Parameter key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="key"
        className={[
          "w-32 rounded bg-otocho-canvas px-2 py-1 font-mono text-xs text-fg-primary placeholder:text-fg-tertiary",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ].join(" ")}
      />
      <span className="text-fg-tertiary text-xs">=</span>
      <input
        aria-label="Parameter value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="value"
        className={[
          "flex-1 rounded bg-otocho-canvas px-2 py-1 font-mono text-xs text-fg-primary placeholder:text-fg-tertiary",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ].join(" ")}
      />
      <button
        type="button"
        aria-label="Delete parameter"
        onClick={() => void onDelete()}
        className="shrink-0 text-fg-tertiary hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
