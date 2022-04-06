/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React, { useRef } from 'react';
import { Container } from '@mui/material';
import { MDXProvider } from '@mdx-js/react';

import mdx from './mdx';

import Content from './Autobrightness.mdx';

// const useStyles = makeStyles(_theme => ({
//   root: {
//     // '& svg': {
//     //   fontSize: '1.5em',
//     //   marginBottom: '-0.25em',
//     //   borderRadius: theme.shape.borderRadius,
//     //   borderWidth: 1,
//     //   borderStyle: 'solid',
//     //   borderColor: theme.palette.divider,
//     //   color: theme.palette.action.active,
//     // },
//     '& p + ul, & p + ol': {
//       marginTop: -16,
//       marginBottom: 16,
//     },
//     '& figure': {
//       display: 'inline-block',
//     },
//     '& figcaption': {
//       textAlign: 'center',
//     },
//   },
// }));

const AutobrightnessHelp: React.FC = () => {
  const refContent = useRef<HTMLDivElement>(null);
  return (
    // <Container maxWidth="lg">
    <MDXProvider components={mdx}>
      <Container
        maxWidth="md"
        sx={{
          '& p + ul, & p + ol': {
            marginTop: -16,
            marginBottom: 16,
          },
          '& figure': {
            display: 'inline-block',
          },
          '& figcaption': {
            textAlign: 'center',
          },
        }}
        ref={refContent}
      >
        <Content />
        {/* <ScrollUp /> */}
      </Container>
    </MDXProvider>
    // </Container>
  );
};

export default AutobrightnessHelp;
