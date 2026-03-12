'use client';

export default function SimpleProjectsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          <li>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-green-100">
                      <span className="text-sm font-medium text-green-800">P</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">Demo Project 1</div>
                    <div className="text-sm text-gray-500">ID: demo-project-1</div>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0 flex">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    active
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-sm text-gray-600">Demo project for testing</div>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-500">
                <span>Created: {new Date().toLocaleDateString()}</span>
                <span>Updated: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </li>
          <li>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-yellow-100">
                      <span className="text-sm font-medium text-yellow-800">P</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">Demo Project 2</div>
                    <div className="text-sm text-gray-500">ID: demo-project-2</div>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0 flex">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    inactive
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-sm text-gray-600">Another demo project</div>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-500">
                <span>Created: {new Date(Date.now() - 86400000).toLocaleDateString()}</span>
                <span>Updated: {new Date(Date.now() - 43200000).toLocaleDateString()}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>

      {/* Start Box */}
      <div className="mt-8 bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Start New Flow</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Start a documentation comment flow to analyze and process documentation.</p>
          </div>
          <div className="mt-5">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Start Doc-Comment Flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}