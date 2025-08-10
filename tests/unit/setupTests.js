import { toMatchImageSnapshot } from 'jest-image-snapshot';
import toContainChunk from './toContainChunk';
import toContainText from './toContainText';

expect.extend(toContainChunk);
expect.extend(toContainText);
expect.extend({ toMatchImageSnapshot });
