import { calendar_v3 } from 'googleapis';
import { cast, DeepReadonly, GuardedMap, Mutable } from '../@types';
import { ISerializableEventsTaskContext } from '../@types/google';
import {
  IEnsureEventsTaskContext,
  IEventsTaskContextBase, IRelevantEventsTaskContext,
  isEnsureEventsTaskContext, isRelevantEventsTaskContext,
} from '../services/google/events.service';
import Schema$Event = calendar_v3.Schema$Event;

export function eventsTaskContextToSerializable(
  context: DeepReadonly<IEventsTaskContextBase>
) {
  const serializable: ISerializableEventsTaskContext = {
    events: Array.from(context.events.entries()) as [string, Schema$Event][]
  };
  if (typeof context.nextPageToken === 'string') {
    serializable.nextPageToken = context.nextPageToken;
  }
  if (isEnsureEventsTaskContext(context)) {
    serializable.insertEvents = Array.from(context.insertEvents.entries());
    serializable.patchEvents = Array.from(context.patchEvents.entries());
  }
  if (isRelevantEventsTaskContext(context)) {
    serializable.relevantEventIds = Array.from(context.relevantEventIds);
  }
  return context;
}

export function eventsTaskContextFromSerializable(
  serializable: DeepReadonly<ISerializableEventsTaskContext>
) {
  const context: IEventsTaskContextBase = {
    events: new Map(serializable.events as any)
  };
  if (typeof serializable.nextPageToken === 'string') {
    context.nextPageToken = serializable.nextPageToken;
  }
  if (serializable.relevantEventIds) {
    cast<Mutable<IRelevantEventsTaskContext>>(context);
    context.relevantEventIds = new Set(serializable.relevantEventIds);
  }
  if (serializable.insertEvents || serializable.patchEvents) {
    cast<Mutable<IEnsureEventsTaskContext>>(context);
    context.insertEvents = new GuardedMap(
      serializable.insertEvents as any ?? []
    );
    context.patchEvents = new GuardedMap(
      serializable.patchEvents as any ?? []
    );
  }
  return context;
}
