import styled from '@emotion/styled';
import React from 'react';

import { sanitizeHref } from '@ui/navigation/link/utils/sanitizeHref';

const StyledButtonLink = styled.a`
  align-items: center;
  color: ${({ theme }) => theme.font.color.light};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(1)};
  text-decoration: none;

  :hover {
    color: ${({ theme }) => theme.font.color.tertiary};
    cursor: pointer;
  }
`;

type ClickToActionLinkProps = React.ComponentProps<'a'> & {
  className?: string;
};

export const ClickToActionLink = (props: ClickToActionLinkProps) => {
  return (
    <StyledButtonLink
      className={props.className}
      href={sanitizeHref(props.href)}
      onClick={props.onClick}
      target={props.target}
      rel={props.rel}
    >
      {props.children}
    </StyledButtonLink>
  );
};
