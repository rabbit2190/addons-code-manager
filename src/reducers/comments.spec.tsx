/* eslint @typescript-eslint/camelcase: 0 */
import { actions as errorsActions } from './errors';
import reducer, {
  CommentInfo,
  actions,
  createCommentKey,
  createEmptyCommentInfo,
  createInternalComment,
  manageComment,
} from './comments';
import { createInternalVersion } from './versions';
import {
  createFakeExternalComment,
  fakeVersion,
  thunkTester,
} from '../test-helpers';

describe(__filename, () => {
  const createCommentInfo = (info: Partial<CommentInfo> = {}): CommentInfo => {
    return {
      ...createEmptyCommentInfo(),
      ...info,
    };
  };

  const keyParams = Object.freeze({
    versionId: 1,
    fileName: 'manifest.json',
    line: 123,
  });

  describe('beginComment', () => {
    it('begins a comment by key', () => {
      const state = reducer(undefined, actions.beginComment(keyParams));

      expect(state.byKey[createCommentKey(keyParams)]).toEqual(
        createCommentInfo({ beginNewComment: true }),
      );
    });

    it('resets historic info', () => {
      let state;

      // Imagine that this happened some time in the past.
      state = reducer(
        state,
        actions.beginSaveComment({
          ...keyParams,
          pendingCommentText: 'Example',
        }),
      );
      // Imagine that the user opened a comment form again.
      state = reducer(state, actions.beginComment(keyParams));

      expect(state.byKey[createCommentKey(keyParams)]).toMatchObject({
        pendingCommentText: null,
        savingComment: false,
      });
    });
  });

  describe('beginSaveComment', () => {
    it('begins saving a comment by key', () => {
      const pendingCommentText = 'Example comment';
      const state = reducer(
        undefined,
        actions.beginSaveComment({ pendingCommentText, ...keyParams }),
      );

      expect(state.byKey[createCommentKey(keyParams)]).toEqual(
        createCommentInfo({ pendingCommentText, savingComment: true }),
      );
    });
  });

  describe('abortSaveComment', () => {
    it('aborts saving a comment by key', () => {
      const pendingCommentText = 'Example of a comment';
      let state;

      state = reducer(
        state,
        actions.beginSaveComment({ ...keyParams, pendingCommentText }),
      );
      state = reducer(state, actions.abortSaveComment(keyParams));

      expect(state.byKey[createCommentKey(keyParams)]).toEqual(
        // This should make sure pendingCommentText is preserved.
        createCommentInfo({ pendingCommentText, savingComment: false }),
      );
    });
  });

  describe('finishComment', () => {
    it('finishes a comment by key', () => {
      const state = reducer(undefined, actions.finishComment(keyParams));

      expect(state.byKey[createCommentKey(keyParams)]).toEqual(
        createCommentInfo({ beginNewComment: false }),
      );
    });

    it('resets comment info', () => {
      let state;

      state = reducer(
        state,
        actions.beginSaveComment({
          ...keyParams,
          pendingCommentText: 'Example',
        }),
      );
      state = reducer(state, actions.finishComment(keyParams));

      expect(state.byKey[createCommentKey(keyParams)]).toMatchObject({
        pendingCommentText: null,
        savingComment: false,
      });
    });
  });

  describe('setComment', () => {
    it('sets a comment for a key', () => {
      const comment = createFakeExternalComment({ id: 54321 });
      const versionId = 1;
      const line = 123;
      const fileName = 'manifest.json';

      const state = reducer(
        undefined,
        actions.setComment({ comment, fileName, line, versionId }),
      );

      expect(state.byId[comment.id]).toEqual(createInternalComment(comment));

      expect(
        state.byKey[createCommentKey({ fileName, line, versionId })],
      ).toMatchObject({
        commentIds: [comment.id],
      });
    });

    it('adds a comment to a key', () => {
      const comment1 = createFakeExternalComment({ id: 1 });
      const comment2 = createFakeExternalComment({ id: 2 });

      const versionId = 1;
      const line = 123;
      const fileName = 'manifest.json';

      let state;
      state = reducer(
        state,
        actions.setComment({ comment: comment1, fileName, line, versionId }),
      );
      state = reducer(
        state,
        actions.setComment({ comment: comment2, fileName, line, versionId }),
      );

      expect(
        state.byKey[createCommentKey({ fileName, line, versionId })],
      ).toMatchObject({
        commentIds: [comment1.id, comment2.id],
      });

      expect(state.byId[comment1.id]).toEqual(createInternalComment(comment1));
      expect(state.byId[comment2.id]).toEqual(createInternalComment(comment2));
    });
  });

  describe('createCommentKey', () => {
    it('creates a key from versionId, fileName, line', () => {
      const versionId = 1;
      const fileName = 'manifest.json';
      const line = 321;

      expect(createCommentKey({ versionId, fileName, line })).toEqual(
        `version:${versionId};file:${fileName};line:${line}`,
      );
    });

    it('creates a key from versionId, fileName', () => {
      const versionId = 1;
      const fileName = 'manifest.json';

      expect(createCommentKey({ versionId, fileName, line: null })).toEqual(
        `version:${versionId};file:${fileName}`,
      );
    });

    it('creates a key from versionId', () => {
      const versionId = 1;

      expect(
        createCommentKey({ versionId, fileName: null, line: null }),
      ).toEqual(`version:${versionId}`);
    });

    it('cannot create a key from just versionId and line', () => {
      expect(() =>
        createCommentKey({ versionId: 1, fileName: null, line: 2 }),
      ).toThrow(/Cannot create key/);
    });
  });

  describe('createInternalComment', () => {
    it('creates a comment', () => {
      const comment = 'Example comment';
      const id = 1;
      const lineno = 321;
      const filename = 'manifest.json';
      const userId = 1;
      const userName = 'Toni';
      const userUrl = 'https://domain/user';
      const userUsername = 'some_user';
      const version = fakeVersion;

      expect(
        createInternalComment({
          canned_response: null,
          comment,
          id,
          lineno,
          filename,
          user: {
            id: userId,
            name: userName,
            url: userUrl,
            username: userUsername,
          },
          version,
        }),
      ).toEqual({
        content: comment,
        id,
        lineno,
        filename,
        userId,
        userName,
        userUrl,
        userUsername,
        version: createInternalVersion(version),
      });
    });
  });

  describe('manageComment', () => {
    const _manageComment = (params = {}) => {
      return manageComment({
        _createOrUpdateComment: jest
          .fn()
          .mockResolvedValue(createFakeExternalComment()),
        addonId: 1,
        cannedResponseId: undefined,
        comment: 'Example of a comment',
        commentId: undefined,
        fileName: null,
        line: null,
        versionId: 432,
        ...params,
      });
    };

    it('calls createOrUpdateComment', async () => {
      const _createOrUpdateComment = jest
        .fn()
        .mockResolvedValue(createFakeExternalComment());
      const addonId = 123;
      const cannedResponseId = undefined;
      const comment = 'A comment on a file';
      const commentId = undefined;
      const fileName = 'manifest.json';
      const line = 543;
      const versionId = 321;

      const { store, thunk } = thunkTester({
        createThunk: () =>
          _manageComment({
            _createOrUpdateComment,
            addonId,
            cannedResponseId,
            comment,
            fileName,
            line,
            versionId,
          }),
      });

      await thunk();

      expect(_createOrUpdateComment).toHaveBeenCalledWith({
        addonId,
        apiState: store.getState().api,
        cannedResponseId,
        comment,
        commentId,
        fileName,
        line,
        versionId,
      });
    });

    it('dispatches beginSaveComment()', async () => {
      const comment = 'Example of a comment';

      const { dispatch, thunk } = thunkTester({
        createThunk: () => _manageComment({ comment, ...keyParams }),
      });

      await thunk();

      expect(dispatch).toHaveBeenCalledWith(
        actions.beginSaveComment({
          pendingCommentText: comment,
          ...keyParams,
        }),
      );
    });

    it('can dispatch beginSaveComment() with empty pendingCommentText', async () => {
      const { dispatch, thunk } = thunkTester({
        // The comment value might be undefined when performing a PATCH request.
        createThunk: () => _manageComment({ comment: undefined, ...keyParams }),
      });

      await thunk();

      expect(dispatch).toHaveBeenCalledWith(
        actions.beginSaveComment({
          ...keyParams,
          pendingCommentText: null,
        }),
      );
    });

    it('dispatches finishComment(), setComment() on success', async () => {
      const fakeComment = createFakeExternalComment();

      const { dispatch, thunk } = thunkTester({
        createThunk: () =>
          _manageComment({
            _createOrUpdateComment: jest.fn().mockResolvedValue(fakeComment),
            ...keyParams,
          }),
      });

      await thunk();

      expect(dispatch).toHaveBeenCalledWith(actions.finishComment(keyParams));
      expect(dispatch).toHaveBeenCalledWith(
        actions.setComment({ comment: fakeComment, ...keyParams }),
      );
    });

    it('dispatches abortSaveComment(), addError() on error', async () => {
      const error = new Error('Bad Request');

      const { dispatch, thunk } = thunkTester({
        createThunk: () =>
          _manageComment({
            _createOrUpdateComment: jest.fn().mockResolvedValue({ error }),
            ...keyParams,
          }),
      });

      await thunk();

      expect(dispatch).toHaveBeenCalledWith(
        actions.abortSaveComment(keyParams),
      );
      expect(dispatch).toHaveBeenCalledWith(errorsActions.addError({ error }));
    });
  });
});