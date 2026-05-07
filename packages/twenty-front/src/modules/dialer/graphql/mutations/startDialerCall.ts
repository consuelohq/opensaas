import { gql } from '@apollo/client';

export const START_DIALER_CALL = gql`
  mutation StartDialerCall($input: StartDialerCallInput!) {
    startDialerCall(input: $input) {
      sessionId
      queueId
      selectionStrategy
      requestedFanout
      actualFanout
      status
      capacity {
        requestedFanout
        callableTargetCount
        availableCallerIdCount
        reducedCapacityReasons
        blockedReasons
        actualFanout
      }
      calls {
        callSid
        contactId
        customerNumber
        callerId
        status
        position
      }
    }
  }
`;
